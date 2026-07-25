import { z } from "zod";
import { TYPES_RECLAMATION, STATUTS_DOSSIER } from "../models/dossierReclamation.js";

export const depotReclamationInSchema = z.object({
  pays: z
    .string()
    .length(2)
    .describe("Code pays ISO, ex: FR"),
  // Optionnelle : déduite du pays côté serveur si absente (US-C2)
  langue: z.string().length(2).optional(),
  typeReclamation: z.enum(TYPES_RECLAMATION),
  description: z.string().min(10).max(5000),
  nomClient: z.string().min(1).max(200),
  emailClient: z.string().email(),
  // Obligatoire au dépôt (US-A1)
  referenceCommande: z.string().min(1).max(100),
  // Obligatoire : sert au calcul de prescription (US-B2), format YYYY-MM-DD
  dateAchat: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD"),
  montantReclame: z.number().min(0).nullable().optional(),
});
export type DepotReclamationIn = z.infer<typeof depotReclamationInSchema>;

export const dossierReclamationOutSchema = z.object({
  numeroDossier: z.string(),
  pays: z.string(),
  langue: z.string(),
  typeReclamation: z.enum(TYPES_RECLAMATION),
  description: z.string(),
  nomClient: z.string(),
  emailClient: z.string(),
  montantReclame: z.number().nullable(),
  statut: z.enum(STATUTS_DOSSIER),
  dateDepot: z.string(),

  // Qualification juridique (US-B4 : visible pour ajustement)
  baseJuridique: z.string().nullable(),
  delaiCibleJours: z.number().nullable(),
  dateEcheance: z.string().nullable(),
  organeEscalade: z.string().nullable(),

  createdAt: z.string(),
});
export type DossierReclamationOut = z.infer<typeof dossierReclamationOutSchema>;