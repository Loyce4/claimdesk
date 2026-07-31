/**
 * Service de génération des courriers.
 *
 * Charge le bon template Handlebars selon la langue du client. Si aucun
 * template n'existe pour cette langue, retombe sur le français par défaut,
 * pour ne jamais bloquer l'envoi d'un courrier en attendant les
 * traductions de Pharelle.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Handlebars from "handlebars";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templatesCourriers");

export interface DonneesCourrier {
  numeroDossier: string;
  nomClient: string;
  dateDepot: string;
  // Qualification (Épopée B) — utile aux courriers de réponse
  typeReclamation?: string;
  baseJuridique?: string | null;
  remedePropose?: string | null;
  delaiCibleJours?: number | null;
  dateEcheance?: string | null;
  recevable?: boolean | null;
  motifIrrecevabilite?: string | null;
  montantReclame?: number | null;
  organeEscalade?: string | null;
}

export function genererCourrier(
  donnees: DonneesCourrier,
  langue: string,
  nomCourrier: string = "accuseReception"
): string {
  const langueNormalisee = (langue || "fr").toLowerCase();

  let chemin = path.join(TEMPLATES_DIR, langueNormalisee, `${nomCourrier}.hbs`);
  if (!existsSync(chemin)) {
    // Pas encore de template pour cette langue -> repli sur le français
    chemin = path.join(TEMPLATES_DIR, "fr", `${nomCourrier}.hbs`);
  }

  const source = readFileSync(chemin, "utf-8");
  const template = Handlebars.compile(source);
  return template(donnees);
}
