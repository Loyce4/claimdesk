/**
 * Gestion des pièces justificatives (US-A2).
 *
 * Les fichiers sont stockés sur le disque du serveur ; seules leurs
 * métadonnées sont enregistrées en base, dans la colonne `pieces_jointes`
 * du dossier. Les formats et la taille sont contrôlés à l'ajout.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

const DOSSIER_STOCKAGE = path.join(process.cwd(), "uploads");

/** Formats acceptés : justificatifs d'achat et photos du produit. */
export const TYPES_MIME_AUTORISES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const TAILLE_MAX_OCTETS = 5 * 1024 * 1024; // 5 Mo

export interface PieceJointe {
  id: string;
  nomFichier: string;
  typeMime: string;
  tailleOctets: number;
  ajouteeLe: string;
}

export interface ResultatAjout {
  ok: boolean;
  erreur?: string;
  piece?: PieceJointe;
}

export async function ajouterPieceJointe(params: {
  numeroDossier: string;
  nomFichier: string;
  typeMime: string;
  contenu: Buffer;
}): Promise<ResultatAjout> {
  if (!TYPES_MIME_AUTORISES.includes(params.typeMime)) {
    return {
      ok: false,
      erreur: `Format non accepté : ${params.typeMime}. Formats autorisés : PDF, JPEG, PNG, WebP.`,
    };
  }

  if (params.contenu.length > TAILLE_MAX_OCTETS) {
    return {
      ok: false,
      erreur: `Fichier trop volumineux (${Math.round(params.contenu.length / 1024)} Ko). Taille maximale : 5 Mo.`,
    };
  }

  const dossierExiste = await pool.query(
    `SELECT 1 FROM dossiers_reclamation WHERE numero_dossier = $1`,
    [params.numeroDossier]
  );
  if (dossierExiste.rows.length === 0) {
    return { ok: false, erreur: "Dossier introuvable." };
  }

  const id = randomUUID();
  const extension = path.extname(params.nomFichier) || "";
  const cheminDisque = path.join(DOSSIER_STOCKAGE, params.numeroDossier, `${id}${extension}`);

  await mkdir(path.dirname(cheminDisque), { recursive: true });
  await writeFile(cheminDisque, params.contenu);

  const piece: PieceJointe = {
    id,
    nomFichier: params.nomFichier,
    typeMime: params.typeMime,
    tailleOctets: params.contenu.length,
    ajouteeLe: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE dossiers_reclamation
        SET pieces_jointes = pieces_jointes || $2::jsonb,
            updated_at = now()
      WHERE numero_dossier = $1`,
    [params.numeroDossier, JSON.stringify([piece])]
  );

  return { ok: true, piece };
}

export async function listerPiecesJointes(numeroDossier: string): Promise<PieceJointe[]> {
  const result = await pool.query(
    `SELECT pieces_jointes FROM dossiers_reclamation WHERE numero_dossier = $1`,
    [numeroDossier]
  );
  if (result.rows.length === 0) return [];
  return (result.rows[0].pieces_jointes ?? []) as PieceJointe[];
}

export async function lirePieceJointe(
  numeroDossier: string,
  idPiece: string
): Promise<{ piece: PieceJointe; contenu: Buffer } | null> {
  const pieces = await listerPiecesJointes(numeroDossier);
  const piece = pieces.find((p) => p.id === idPiece);
  if (!piece) return null;

  const extension = path.extname(piece.nomFichier) || "";
  const cheminDisque = path.join(DOSSIER_STOCKAGE, numeroDossier, `${idPiece}${extension}`);
  if (!existsSync(cheminDisque)) return null;

  return { piece, contenu: await readFile(cheminDisque) };
}