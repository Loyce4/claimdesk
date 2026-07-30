/**
 * Moteur de règles juridiques.
 *
 * Règle d'or : ce fichier ne doit contenir AUCUNE règle juridique en dur.
 * Toutes les règles viennent de `reglesJuridiques.json`, fourni et mis à
 * jour par l'équipe Droit international (Félicite).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { DossierReclamation, TypeReclamation } from "../models/dossierReclamation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGLES_PATH = path.join(__dirname, "reglesJuridiques.json");

export interface RegleJuridique {
  typeReclamation: string;
  pays: string;
  baseJuridique?: string;
  conditionRecevabilite?: string;
  remedePossible?: string;
  delaiCibleJours?: number;
  delaiPrescriptionJours?: number;
  organeEscalade?: string;
  source?: string;
  dateVerification?: string;
}

function chargerRegles(): RegleJuridique[] {
  const contenu = readFileSync(REGLES_PATH, "utf-8");
  const data = JSON.parse(contenu);
  return data.regles as RegleJuridique[];
}

export function trouverRegle(
  typeReclamation: string,
  pays: string
): RegleJuridique | undefined {
  const regles = chargerRegles();
  // Règle spécifique au pays en priorité, sinon règle générale "*"
  return (
    regles.find((r) => r.typeReclamation === typeReclamation && r.pays === pays) ??
    regles.find((r) => r.typeReclamation === typeReclamation && r.pays === "*")
  );
}
/** Prescriptions par pays, lues depuis le JSON juridique (garantie légale de conformité). */
function chargerPrescriptions(): Record<string, number> {
  const contenu = readFileSync(REGLES_PATH, "utf-8");
  const data = JSON.parse(contenu);
  return (data.prescriptionMoisParPays ?? {}) as Record<string, number>;
}

/**
 * Évalue la recevabilité d'une réclamation au regard du délai de prescription
 * du pays (US-B2). Retourne `null` si aucune prescription n'est définie pour
 * ce pays : le dossier reste alors à qualifier manuellement.
 */
export function evaluerRecevabilite(params: {
  pays: string;
  dateAchat: Date;
  dateDepot: Date;
}): { recevable: boolean | null; motifIrrecevabilite: string | null; prescriptionMois: number | null } {
  const prescriptionMois = chargerPrescriptions()[params.pays];

  if (prescriptionMois === undefined) {
    return { recevable: null, motifIrrecevabilite: null, prescriptionMois: null };
  }

  const dateLimite = new Date(params.dateAchat);
  dateLimite.setMonth(dateLimite.getMonth() + prescriptionMois);

  if (params.dateDepot > dateLimite) {
    const limiteTexte = dateLimite.toLocaleDateString("fr-CA");
    return {
      recevable: false,
      motifIrrecevabilite:
        `Réclamation hors délai : la garantie légale de ${prescriptionMois} mois applicable ` +
        `en ${params.pays} a expiré le ${limiteTexte}.`,
      prescriptionMois,
    };
  }

  return { recevable: true, motifIrrecevabilite: null, prescriptionMois };
}
/**
 * À appeler au dépôt du dossier pour renseigner automatiquement :
 * baseJuridique, delaiCibleJours, dateEcheance, organeEscalade.
 *
 * Ne lève pas d'exception si aucune règle n'existe encore pour ce type de
 * réclamation / pays — le dossier reste créé, juste sans échéance, à
 * qualifier manuellement en attendant que la matrice juridique soit
 * complétée.
 */
export function appliquerRegle(dossier: {
  typeReclamation: TypeReclamation;
  pays: string;
  dateDepot: Date;
}): {
  baseJuridique: string | null;
  organeEscalade: string | null;
  delaiCibleJours: number | null;
  dateEcheance: Date | null;
} {
  const regle = trouverRegle(dossier.typeReclamation, dossier.pays);

  if (!regle) {
    return {
      baseJuridique: null,
      organeEscalade: null,
      delaiCibleJours: null,
      dateEcheance: null,
    };
  }

  let dateEcheance: Date | null = null;
  if (regle.delaiCibleJours !== undefined) {
    dateEcheance = new Date(dossier.dateDepot);
    dateEcheance.setDate(dateEcheance.getDate() + regle.delaiCibleJours);
  }

  return {
    baseJuridique: regle.baseJuridique ?? null,
    organeEscalade: regle.organeEscalade ?? null,
    delaiCibleJours: regle.delaiCibleJours ?? null,
    dateEcheance,
  };
}
