/**
 * Génération du numéro de dossier.
 *
 * Format : PAYS-ANNEE-000001 (compteur par pays et par année).
 */

import type { Pool } from "pg";

export async function genererNumeroDossier(pool: Pool, pays: string): Promise<string> {
  const paysMaj = pays.toUpperCase();
  const annee = new Date().getFullYear();
  const prefixe = `${paysMaj}-${annee}-`;

  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM dossiers_reclamation WHERE numero_dossier LIKE $1`,
    [`${prefixe}%`]
  );

  const compteur = parseInt(result.rows[0].count, 10) + 1;
  return `${prefixe}${String(compteur).padStart(6, "0")}`;
}
