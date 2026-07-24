/**
 * Format commun du dossier de réclamation.
 *
 * C'est la base sur laquelle s'appuient : le formulaire de dépôt, le moteur
 * de règles juridiques, la génération de courriers, le suivi temps réel
 * (WebSocket) et la connexion Odoo.
 */

export const TYPES_RECLAMATION = [
  "produit_non_conforme",
  "non_livraison",
  "retractation",
] as const;
export type TypeReclamation = (typeof TYPES_RECLAMATION)[number];

export const STATUTS_DOSSIER = [
  "depose",
  "en_cours",
  "en_attente_pieces",
  "proposition_envoyee",
  "escalade",
  "cloture",
] as const;
export type StatutDossier = (typeof STATUTS_DOSSIER)[number];

export const PAYS_AUTORISES = ["FR", "DE", "ES", "IT", "BE", "NL", "PL"] as const;
export type Pays = (typeof PAYS_AUTORISES)[number];

export interface DossierReclamation {
  id: string;
  numeroDossier: string;
  pays: string;
  langue: string;
  typeReclamation: TypeReclamation;
  description: string;
  nomClient: string;
  emailClient: string;
  montantReclame: number | null;

  dateDepot: string; // format YYYY-MM-DD
  statut: StatutDossier;

  // Renseignés automatiquement par le moteur de règles
  baseJuridique: string | null;
  delaiCibleJours: number | null;
  dateEcheance: string | null;
  organeEscalade: string | null;

  createdAt: string;
  updatedAt: string;
}
