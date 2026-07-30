/**
 * Validation des règlements (US-E1).
 *
 * Le passage en état « Résolu » n'est autorisé que depuis un état
 * conforme à la machine à états (US-D2).
 */

import { pool } from "../db/pool.js";
import { TRANSITIONS, type StatutDossier } from "../models/dossierReclamation.js";

export interface ResultatReglement {
  ok: boolean;
  erreur?: string;
  dossier?: {
    numeroDossier: string;
    statut: string;
    montantIndemniteEur: number | null;
    delaiTraitementJours: number | null;
    regleLe: string | null;
    langue: string;
    nomClient: string;
    emailClient: string;
  };
}

export async function validerReglement(params: {
  numeroDossier: string;
  montantIndemniteEur: number;
  auteur: string;
}): Promise<ResultatReglement> {
  const existant = await pool.query(
    `SELECT statut, date_depot FROM dossiers_reclamation WHERE numero_dossier = $1`,
    [params.numeroDossier]
  );

  if (existant.rows.length === 0) {
    return { ok: false, erreur: "Dossier introuvable." };
  }

  const statutActuel = existant.rows[0].statut as StatutDossier;
  if (!TRANSITIONS[statutActuel].includes("resolu")) {
    return {
      ok: false,
      erreur: `Transition interdite : un dossier en état '${statutActuel}' ne peut pas passer directement en 'resolu'.`,
    };
  }

  const dateDepot = new Date(existant.rows[0].date_depot);
  const delaiTraitementJours = Math.round(
    (Date.now() - dateDepot.getTime()) / (1000 * 60 * 60 * 24)
  );

  const result = await pool.query(
    `UPDATE dossiers_reclamation
        SET statut = 'resolu',
            montant_indemnite_eur = $2,
            delai_traitement_jours = $3,
            regle_le = now(),
            updated_at = now(),
            historique = historique || $4::jsonb
      WHERE numero_dossier = $1
      RETURNING numero_dossier, statut, montant_indemnite_eur,
                delai_traitement_jours, regle_le, langue, nom_client, email_client`,
    [
      params.numeroDossier,
      params.montantIndemniteEur,
      delaiTraitementJours,
      JSON.stringify([
        {
          statut: "resolu",
          date: new Date().toISOString(),
          auteur: params.auteur,
          montantIndemniteEur: params.montantIndemniteEur,
        },
      ]),
    ]
  );

  const row = result.rows[0];
  return {
    ok: true,
    dossier: {
      numeroDossier: row.numero_dossier,
      statut: row.statut,
      montantIndemniteEur: row.montant_indemnite_eur !== null ? Number(row.montant_indemnite_eur) : null,
      delaiTraitementJours: row.delai_traitement_jours,
      regleLe: row.regle_le ? row.regle_le.toISOString() : null,
      langue: row.langue,
      nomClient: row.nom_client,
      emailClient: row.email_client,
    },
  };
}