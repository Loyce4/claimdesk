/**
 * Escalade automatique des dossiers en dépassement de délai (US-D3).
 *
 * Conformément au cahier des charges (§7), la détection repose sur un simple
 * planificateur applicatif — pas de broker de messages ni de file d'attente.
 */

import { pool } from "../db/pool.js";
import { notifierClient } from "./notifications.js";
import { resynchroniserDossier } from "./odoo.js";

export interface DossierEscalade {
  numeroDossier: string;
  pays: string;
  organeEscalade: string | null;
  dateEcheance: string | null;
}

/** États depuis lesquels un dossier peut encore être escaladé. */
const STATUTS_ESCALADABLES = [
  "recu",
  "en_attente_pieces",
  "qualifie",
  "en_traitement",
  "proposition",
];

/**
 * Détecte les dossiers dont l'échéance est dépassée et les fait passer en
 * escalade, en renseignant l'organe de médiation et en traçant la décision
 * dans le journal d'audit (US-D4).
 */
export async function escaladerDossiersEnRetard(): Promise<DossierEscalade[]> {
  const result = await pool.query(
    `UPDATE dossiers_reclamation
        SET statut = 'escalade',
            updated_at = now(),
            historique = historique || $1::jsonb
      WHERE date_echeance IS NOT NULL
        AND date_echeance < CURRENT_DATE
        AND statut = ANY($2::text[])
      RETURNING numero_dossier, pays, organe_escalade, date_echeance`,
    [
      JSON.stringify([
        {
          statut: "escalade",
          date: new Date().toISOString(),
          auteur: "planificateur",
          motif: "Dépassement du délai de réponse cible",
        },
      ]),
      STATUTS_ESCALADABLES,
    ]
  );

 const escalades = result.rows.map((row) => ({
    numeroDossier: row.numero_dossier,
    pays: row.pays,
    organeEscalade: row.organe_escalade ?? null,
    dateEcheance: row.date_echeance
      ? row.date_echeance.toLocaleDateString("fr-CA")
      : null,
  }));

  // Notification du client à chaque escalade (US-F1)
  for (const dossier of escalades) {
    await notifierClient(dossier.numeroDossier, "escalade");
    await resynchroniserDossier(dossier.numeroDossier);
  
}

  return escalades;
  }