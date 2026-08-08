/**
 * Service d'envoi des courriers (US-C3).
 *
 * L'email est réellement envoyé via le compte Gmail configuré dans
 * SMTP_USER / SMTP_PASS (.env), en plus d'être journalisé en base
 * (traçabilité exigée : date, destinataire, type).
 *
 * La journalisation en base se fait toujours en premier, avant l'envoi
 * réel : un envoi SMTP lent ou en échec ne doit jamais retarder ni
 * bloquer le reste du parcours (même principe que la synchronisation
 * Odoo, voir odoo.ts).
 */

import nodemailer from "nodemailer";
import { pool } from "../db/pool.js";

export interface EnvoiCourrier {
  numeroDossier: string;
  typeCourrier: string;
  destinataire: string;
  langue: string;
  contenu: string;
}

let transporteur: ReturnType<typeof nodemailer.createTransport> | null = null;

function obtenirTransporteur() {
  if (!transporteur) {
    transporteur = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporteur;
}

function sujetParTypeCourrier(typeCourrier: string, numeroDossier: string): string {
  const sujets: Record<string, string> = {
    accuseReception: `Votre réclamation ${numeroDossier} a bien été reçue`,
    demandePieces: `Pièces complémentaires nécessaires — dossier ${numeroDossier}`,
    proposition: `Proposition concernant votre réclamation ${numeroDossier}`,
    escalade: `Mise à jour de votre dossier ${numeroDossier}`,
    notificationReglement: `Règlement de votre réclamation ${numeroDossier}`,
    cloture: `Votre dossier ${numeroDossier} est clôturé`,
  };
  return sujets[typeCourrier] ?? `Mise à jour de votre dossier ${numeroDossier}`;
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

  // Envoi réel en tâche de fond : ne bloque jamais l'appelant.
  obtenirTransporteur()
    .sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: envoi.destinataire,
      subject: sujetParTypeCourrier(envoi.typeCourrier, envoi.numeroDossier),
      text: envoi.contenu,
    })
    .catch((err) => {
      console.error(`Echec de l'envoi d'email pour le dossier ${envoi.numeroDossier} :`, err);
    });

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