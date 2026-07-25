/**
 * Format commun du dossier de réclamation.
 *
 * C'est la base sur laquelle s'appuient : le formulaire de dépôt, le moteur
 * de règles juridiques, la génération de courriers, le suivi temps réel
 * (WebSocket) et la connexion Odoo.
 *
 * Contrat d'interface commun (§6 du cahier des charges) — toute modification
 * doit être validée en équipe.
 */

// Types de réclamation — alignés sur la matrice de qualification (§11)
export const TYPES_RECLAMATION = [
  "produit_non_conforme",
  "non_livraison",
  "retractation",
  "contenu_numerique_defectueux",
  "litige_facturation",
] as const;
export type TypeReclamation = (typeof TYPES_RECLAMATION)[number];

// Pays du périmètre (§1)
export const PAYS_CLIENTS = ["FR", "DE", "ES", "IT", "BE", "NL", "PL"] as const;
export type PaysClient = (typeof PAYS_CLIENTS)[number];

// Machine à états (US-D2 + US-E1)
export const STATUTS_DOSSIER = [
  "recu",
  "qualifie",
  "en_attente_pieces",
  "en_traitement",
  "proposition",
  "escalade",
  "resolu",
  "cloture",
] as const;
export type StatutDossier = (typeof STATUTS_DOSSIER)[number];

// Transitions autorisées de la machine à états (US-D2, US-D3, US-E1)
export const TRANSITIONS: Record<StatutDossier, StatutDossier[]> = {
  recu:              ["qualifie", "en_attente_pieces"],
  en_attente_pieces: ["qualifie"],
  qualifie:          ["en_traitement", "cloture"], // clôture directe si irrecevable
  en_traitement:     ["proposition", "escalade"],
  proposition:       ["resolu", "escalade"],
  escalade:          ["proposition", "resolu", "cloture"],
  resolu:            ["cloture"],
  cloture:           [],
};

export interface DossierReclamation {
  // Identité
  id: string;
  numeroDossier: string; // référence publique — accès sans compte (US-A4)

  // Client & contexte
  pays: PaysClient;
  langue: string; // déduite du pays (US-C2)
  nomClient: string;
  emailClient: string;
  referenceCommande: string;

  // Réclamation
  typeReclamation: TypeReclamation;
  description: string;
  montantReclame: number | null;
  dateAchat: string; // YYYY-MM-DD — sert au calcul de prescription (US-B2)

  dateDepot: string; // format YYYY-MM-DD
  statut: StatutDossier;

  // Renseignés automatiquement par le moteur de règles (Épopée B)
  baseJuridique: string | null;      // ex. "Dir. (UE) 2019/771"
  prescriptionAns: number | null;    // délai de prescription du pays
  recevable: boolean | null;         // null = pas encore évalué (US-B2)
  motifIrrecevabilite: string | null;
  remedePropose: string | null;      // réparation, remboursement... (US-B3)
  delaiCibleJours: number | null;
  dateEcheance: string | null;       // détection de retard (US-D3)
  organeEscalade: string | null;

  // Règlement (Épopée E)
  montantIndemniteEur: number | null;
  delaiTraitementJours: number | null;

  // Traçabilité (US-D4)
  createdAt: string;
  updatedAt: string;

}

 // Langue par défaut déduite du pays du client (US-C2)
export const LANGUE_PAR_PAYS: Record<PaysClient, string> = {
  FR: "fr",
  DE: "de",
  ES: "es",
  IT: "it",
  BE: "fr", // ⚠️ à valider en équipe : fr ou nl ?
  NL: "nl",
  PL: "pl",
};