import { z } from "zod";
import { TYPES_RECLAMATION, STATUTS_DOSSIER } from "../models/dossierReclamation.js";

export const depotReclamationInSchema = z.object({
  pays: z
    .string()
    .length(2)
    .describe("Code pays ISO, ex: FR"),
  langue: z.string().length(2),
  typeReclamation: z.enum(TYPES_RECLAMATION),
  description: z.string().min(10).max(5000),
  nomClient: z.string().min(1).max(200),
  emailClient: z.string().email(),
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
  statut: z.enum(STATUTS_DOSSIER),
  dateDepot: z.string(),
  dateEcheance: z.string().nullable(),
  createdAt: z.string(),
});
export type DossierReclamationOut = z.infer<typeof dossierReclamationOutSchema>;
