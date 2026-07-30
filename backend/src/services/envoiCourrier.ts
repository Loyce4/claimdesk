/**
 * Service d'envoi des courriers (US-C3).
 *
 * En développement, l'envoi est simulé : le courrier est journalisé en base
 * (traçabilité exigée : date, destinataire, type) et écrit dans les logs.
 * Le branchement d'un vrai fournisseur (type SendGrid) se fera ici sans
 * impacter le reste de l'application.
 */

import { pool } from "../db/pool.js";

export interface EnvoiCourrier {
  numeroDossier: string;
  typeCourrier: string;
  destinataire: string;
  langue: string;
  contenu: string;
}

export async function envoyerCourrier(envoi: EnvoiCourrier): Promise<{
  envoyeLe: string;
  statutEnvoi: string;
}> {
  const result = await pool.query(
    `INSERT INTO envois_courriers
      (numero_dossier, type_courrier, destinataire, langue, contenu)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING envoye_le, statut_envoi`,
    [
      envoi.numeroDossier,
      envoi.typeCourrier,
      envoi.destinataire,
      envoi.langue,
      envoi.contenu,
    ]
  );

  return {
    envoyeLe: result.rows[0].envoye_le.toISOString(),
    statutEnvoi: result.rows[0].statut_envoi,
  };
}

/** Historique des envois d'un dossier (US-F3 : mesure des envois). */
export async function listerEnvois(numeroDossier: string) {
  const result = await pool.query(
    `SELECT type_courrier, destinataire, langue, statut_envoi, envoye_le
       FROM envois_courriers
      WHERE numero_dossier = $1
      ORDER BY envoye_le DESC`,
    [numeroDossier]
  );

  return result.rows.map((row) => ({
    typeCourrier: row.type_courrier,
    destinataire: row.destinataire,
    langue: row.langue,
    statutEnvoi: row.statut_envoi,
    envoyeLe: row.envoye_le.toISOString(),
  }));
}