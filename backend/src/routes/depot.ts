import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { depotReclamationInSchema, dossierReclamationOutSchema } from "../schemas/reclamation.js";
import { genererNumeroDossier } from "../services/numerotation.js";
import { appliquerRegle } from "../rulesEngine/moteur.js";
import { genererCourrier } from "../services/courriers.js";
import { PAYS_AUTORISES } from "../models/dossierReclamation.js";
import type { TypeReclamation } from "../models/dossierReclamation.js";

function mapRowVersDossierOut(row: any) {
  return {
    numeroDossier: row.numero_dossier,
    pays: row.pays,
    langue: row.langue,
    typeReclamation: row.type_reclamation,
    description: row.description,
    nomClient: row.nom_client,
    statut: row.statut,
    dateDepot: row.date_depot.toISOString().slice(0, 10),
    dateEcheance: row.date_echeance ? row.date_echeance.toISOString().slice(0, 10) : null,
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

      if (!(PAYS_AUTORISES as readonly string[]).includes(paysMaj)) {
        return reply.status(400).send({
          message: `Pays '${payload.pays}' hors périmètre (FR, DE, ES, IT, BE, NL, PL).`,
        });
      }

      const numeroDossier = await genererNumeroDossier(pool, paysMaj);
      const dateDepot = new Date();

      const resultatRegle = appliquerRegle({
        typeReclamation: payload.typeReclamation as TypeReclamation,
        pays: paysMaj,
        dateDepot,
      });

      const insertResult = await pool.query(
        `INSERT INTO dossiers_reclamation
          (numero_dossier, pays, langue, type_reclamation, description,
           nom_client, email_client, montant_reclame, date_depot, statut,
           base_juridique, delai_cible_jours, date_echeance, organe_escalade,
           historique)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'depose',$10,$11,$12,$13,$14::jsonb)
         RETURNING *`,
        [
          numeroDossier,
          paysMaj,
          payload.langue.toLowerCase(),
          payload.typeReclamation,
          payload.description,
          payload.nomClient,
          payload.emailClient,
          payload.montantReclame ?? null,
          dateDepot,
          resultatRegle.baseJuridique,
          resultatRegle.delaiCibleJours,
          resultatRegle.dateEcheance,
          resultatRegle.organeEscalade,
          JSON.stringify([
            { statut: "depose", date: dateDepot.toISOString(), auteur: "client" },
          ]),
        ]
      );

      const dossier = mapRowVersDossierOut(insertResult.rows[0]);

      // Notifie les clients WebSocket abonnés au suivi de ce dossier
      fastify.publierMiseAJourDossier?.(dossier.numeroDossier, dossier);

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
          dateDepot: row.date_depot.toISOString().slice(0, 10),
        },
        row.langue,
        nomCourrier
      );

      return reply.type("text/plain").send(texte);
    }
  );
};
