/**
 * Notifications du client aux étapes clés du dossier (US-F1).
 *
 * Centralise le choix du gabarit selon l'événement, la génération dans la
 * langue du client et l'envoi tracé. Les routes n'ont plus qu'à déclarer
 * l'événement survenu.
 */

import { pool } from "../db/pool.js";
import { genererCourrier } from "./courriers.js";
import { envoyerCourrier } from "./envoiCourrier.js";

/** Étapes du dossier donnant lieu à une notification client. */
export type EvenementDossier =
  | "accuseReception"
  | "demandePieces"
  | "proposition"
  | "escalade"
  | "notificationReglement"
  | "cloture";

export async function notifierClient(
  numeroDossier: string,
  evenement: EvenementDossier
): Promise<boolean> {
  const result = await pool.query(
    `SELECT numero_dossier, nom_client, email_client, langue, type_reclamation,
            date_depot, base_juridique, delai_cible_jours, date_echeance,
            organe_escalade, recevable, motif_irrecevabilite,
            montant_reclame, montant_indemnite_eur, delai_traitement_jours
       FROM dossiers_reclamation
      WHERE numero_dossier = $1`,
    [numeroDossier]
  );

  if (result.rows.length === 0) return false;
  const row = result.rows[0];

  const enTexte = (valeur: unknown) =>
    valeur instanceof Date ? valeur.toLocaleDateString("fr-CA") : (valeur ?? null);

  const texte = genererCourrier(
    {
      numeroDossier: row.numero_dossier,
      nomClient: row.nom_client,
      dateDepot: enTexte(row.date_depot) as string,
      typeReclamation: row.type_reclamation,
      baseJuridique: row.base_juridique ?? null,
      delaiCibleJours:
        evenement === "notificationReglement"
          ? row.delai_traitement_jours ?? null
          : row.delai_cible_jours ?? null,
      dateEcheance: enTexte(row.date_echeance) as string | null,
      recevable: row.recevable ?? null,
      motifIrrecevabilite: row.motif_irrecevabilite ?? null,
      montantReclame:
        evenement === "notificationReglement"
          ? (row.montant_indemnite_eur !== null ? Number(row.montant_indemnite_eur) : null)
          : (row.montant_reclame !== null ? Number(row.montant_reclame) : null),
      organeEscalade: row.organe_escalade ?? null,
    },
    row.langue,
    evenement
  );

  await envoyerCourrier({
    numeroDossier: row.numero_dossier,
    typeCourrier: evenement,
    destinataire: row.email_client,
    langue: row.langue,
    contenu: texte,
  });

  return true;
}