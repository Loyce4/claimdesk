import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { depotReclamationInSchema, dossierReclamationOutSchema } from "../schemas/reclamation.js";
import { genererNumeroDossier } from "../services/numerotation.js";
import { genererCourrier } from "../services/courriers.js";
import { synchroniserVersOdoo } from "../services/odoo.js";
import { PAYS_CLIENTS, LANGUE_PAR_PAYS } from "../models/dossierReclamation.js";
import type { PaysClient, TypeReclamation } from "../models/dossierReclamation.js";
import { appliquerRegle, evaluerRecevabilite } from "../rulesEngine/moteur.js";
function mapRowVersDossierOut(row: any) {
  return {
    numeroDossier: row.numero_dossier,
    pays: row.pays,
    langue: row.langue,
    typeReclamation: row.type_reclamation,
    description: row.description,
    nomClient: row.nom_client,
    emailClient: row.email_client,
    montantReclame: row.montant_reclame !== null ? Number(row.montant_reclame) : null,
    statut: row.statut,
    dateDepot: row.date_depot instanceof Date
    ? row.date_depot.toLocaleDateString("fr-CA")
    : row.date_depot,
    // Qualification juridique (US-B4 : visible pour ajustement)
    baseJuridique: row.base_juridique ?? null,
    delaiCibleJours: row.delai_cible_jours ?? null,
    dateEcheance: row.date_echeance
    ? (row.date_echeance instanceof Date
    ? row.date_echeance.toLocaleDateString("fr-CA")
    : row.date_echeance)
    : null,
    organeEscalade: row.organe_escalade ?? null,
    recevable: row.recevable ?? null,
    motifIrrecevabilite: row.motif_irrecevabilite ?? null,

    createdAt: row.created_at.toISOString(),
  };

}

export const depotRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/reclamations",
    {
      schema: {
        tags: ["dépôt"],
        summary: "Déposer une réclamation",
        body: depotReclamationInSchema,
        response: {
          201: dossierReclamationOutSchema,
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const payload = request.body;
      const paysMaj = payload.pays.toUpperCase();

      if (!(PAYS_CLIENTS as readonly string[]).includes(paysMaj)) {
        return reply.status(400).send({
          message: `Pays '${payload.pays}' hors périmètre (FR, DE, ES, IT, BE, NL, PL).`,
        });
      }
      // Langue déduite du pays (US-C2) — le client peut la surcharger
const langue = payload.langue?.toLowerCase() ?? LANGUE_PAR_PAYS[paysMaj as PaysClient];


      const numeroDossier = await genererNumeroDossier(pool, paysMaj);
      const dateDepot = new Date();

      const resultatRegle = appliquerRegle({
        typeReclamation: payload.typeReclamation as TypeReclamation,
        pays: paysMaj,
        dateDepot,
      });
      const recevabilite = evaluerRecevabilite({
  pays: paysMaj,
  dateAchat: new Date(payload.dateAchat),
  dateDepot,
});

      const insertResult = await pool.query(
        `INSERT INTO dossiers_reclamation
          (numero_dossier, pays, langue, type_reclamation, description,
           nom_client, email_client, montant_reclame, reference_commande, date_achat,
           date_depot, statut, base_juridique, delai_cible_jours, date_echeance,
           organe_escalade, recevable, motif_irrecevabilite, historique)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'recu',$12,$13,$14,$15,$16,$17,$18::jsonb)
         RETURNING *`,
        [
          numeroDossier,
          paysMaj,
          langue,
          payload.typeReclamation,
          payload.description,
          payload.nomClient,
          payload.emailClient,
          payload.montantReclame ?? null,
          payload.referenceCommande,
          payload.dateAchat,
          dateDepot,
          resultatRegle.baseJuridique,
          resultatRegle.delaiCibleJours,
          resultatRegle.dateEcheance,
          resultatRegle.organeEscalade,
          recevabilite.recevable,
          recevabilite.motifIrrecevabilite,
          JSON.stringify([
            { statut: "recu", date: dateDepot.toISOString(), auteur: "client" },
          ]),
        ]
      );

      const dossier = mapRowVersDossierOut(insertResult.rows[0]);
      

      // Notifie les clients WebSocket abonnés au suivi de ce dossier
      fastify.publierMiseAJourDossier?.(dossier.numeroDossier, dossier);

      // Synchronise vers Odoo, en tâche de fond (n'attend pas la réponse
      // Odoo pour répondre au client — l'ERP peut être lent ou temporairement
      // indisponible sans jamais bloquer le dépôt de la réclamation).
      synchroniserVersOdoo({
        numeroDossier: dossier.numeroDossier,
        pays: dossier.pays,
        typeReclamation: dossier.typeReclamation,
        description: dossier.description,
        nomClient: dossier.nomClient,
        emailClient: payload.emailClient,
        montantReclame: payload.montantReclame ?? null,
        statut: dossier.statut,
        dateEcheance: dossier.dateEcheance,
      }).catch((err) => fastify.log.error(err, "Échec de synchronisation Odoo"));

      return reply.status(201).send(dossier);
    }
  );

  app.get(
    "/reclamations/:numeroDossier",
    {
      schema: {
        tags: ["dépôt"],
        summary: "Consulter une réclamation",
        params: z.object({ numeroDossier: z.string() }),
        response: {
          200: dossierReclamationOutSchema,
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { numeroDossier } = request.params;
      const result = await pool.query(
        `SELECT * FROM dossiers_reclamation WHERE numero_dossier = $1`,
        [numeroDossier]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ message: "Dossier introuvable." });
      }

      return reply.send(mapRowVersDossierOut(result.rows[0]));
    }
  );

  app.get(
    "/reclamations/:numeroDossier/courrier",
    {
      schema: {
        tags: ["dépôt"],
        summary: "Générer le courrier d'un dossier",
        params: z.object({ numeroDossier: z.string() }),
        querystring: z.object({ nomCourrier: z.string().optional() }),
      },
    },
    async (request, reply) => {
      const { numeroDossier } = request.params;
      const { nomCourrier } = request.query;

      const result = await pool.query(
        `SELECT * FROM dossiers_reclamation WHERE numero_dossier = $1`,
        [numeroDossier]
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ message: "Dossier introuvable." });
      }

      const row = result.rows[0];
      const texte = genererCourrier(
        {
          numeroDossier: row.numero_dossier,
          nomClient: row.nom_client,
          dateDepot: row.date_depot instanceof Date
            ? row.date_depot.toLocaleDateString("fr-CA")
            : row.date_depot,
          typeReclamation: row.type_reclamation,
          baseJuridique: row.base_juridique ?? null,
          delaiCibleJours: row.delai_cible_jours ?? null,
          dateEcheance: row.date_echeance instanceof Date
            ? row.date_echeance.toLocaleDateString("fr-CA")
            : (row.date_echeance ?? null),
          recevable: row.recevable ?? null,
          motifIrrecevabilite: row.motif_irrecevabilite ?? null,
          montantReclame: row.montant_reclame !== null ? Number(row.montant_reclame) : null,
        },
        row.langue,
        nomCourrier
      );
      return reply.type("text/plain; charset=utf-8").send(texte);
    }
  );
};
