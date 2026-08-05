/**
 * Ajustement de la qualification juridique par un juriste (US-B4).
 *
 * Le moteur de règles propose une qualification automatique au dépôt
 * (US-B1 à B3). Cette fonction permet à un juriste de la corriger avant
 * traitement, tout en conservant la trace de la décision automatique et
 * de l'ajustement humain dans l'historique du dossier.
 */

import { pool } from "../db/pool.js";
import { resynchroniserDossier } from "./odoo.js";

export interface ResultatAjustementQualification {
  ok: boolean;
  erreur?: string;
  dossier?: {
    numeroDossier: string;
    statut: string;
    baseJuridique: string | null;
    delaiCibleJours: number | null;
    dateEcheance: string | null;
  };
}

function ajouterJours(date: Date, jours: number): string {
  const resultat = new Date(date);
  resultat.setDate(resultat.getDate() + jours);
  return resultat.toLocaleDateString("fr-CA");
}

export async function ajusterQualification(params: {
  numeroDossier: string;
  baseJuridique?: string;
  delaiCibleJours?: number;
  auteur: string;
  justification: string;
}): Promise<ResultatAjustementQualification> {
  const existant = await pool.query(
    `SELECT statut, date_depot, base_juridique, delai_cible_jours, date_echeance
       FROM dossiers_reclamation WHERE numero_dossier = $1`,
    [params.numeroDossier]
  );

  if (existant.rows.length === 0) {
    return { ok: false, erreur: "Dossier introuvable." };
  }

  const row = existant.rows[0];

  if (row.statut === "resolu" || row.statut === "cloture") {
    return {
      ok: false,
      erreur: `La qualification ne peut plus être ajustée : le dossier est en état '${row.statut}'.`,
    };
  }

  const nouvelleBaseJuridique = params.baseJuridique ?? row.base_juridique;
  const nouveauDelaiCibleJours = params.delaiCibleJours ?? row.delai_cible_jours;
  const nouvelleDateEcheance =
    params.delaiCibleJours !== undefined
      ? ajouterJours(new Date(row.date_depot), params.delaiCibleJours)
      : row.date_echeance;

  const result = await pool.query(
    `UPDATE dossiers_reclamation
        SET base_juridique = $2,
            delai_cible_jours = $3,
            date_echeance = $4,
            updated_at = now(),
            historique = historique || $5::jsonb
      WHERE numero_dossier = $1
      RETURNING numero_dossier, statut, base_juridique, delai_cible_jours, date_echeance`,
    [
      params.numeroDossier,
      nouvelleBaseJuridique,
      nouveauDelaiCibleJours,
      nouvelleDateEcheance,
      JSON.stringify([
        {
          action: "ajustementQualification",
          auteur: params.auteur,
          justification: params.justification,
          date: new Date().toISOString(),
          ancienneBaseJuridique: row.base_juridique,
          nouvelleBaseJuridique,
          ancienDelaiCibleJours: row.delai_cible_jours,
          nouveauDelaiCibleJours,
        },
      ]),
    ]
  );

  const dossierMisAJour = result.rows[0];

  // Reflète l'ajustement dans Odoo (US-G1) — best effort, ne bloque jamais
  resynchroniserDossier(params.numeroDossier).catch(() => {});

  return {
    ok: true,
    dossier: {
      numeroDossier: dossierMisAJour.numero_dossier,
      statut: dossierMisAJour.statut,
      baseJuridique: dossierMisAJour.base_juridique,
      delaiCibleJours: dossierMisAJour.delai_cible_jours,
      dateEcheance: dossierMisAJour.date_echeance
        ? (dossierMisAJour.date_echeance instanceof Date
            ? dossierMisAJour.date_echeance.toLocaleDateString("fr-CA")
            : dossierMisAJour.date_echeance)
        : null,
    },
  };
}