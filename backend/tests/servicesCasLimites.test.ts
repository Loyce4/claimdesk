import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "../src/db/pool.js";
import { validerReglement } from "../src/services/reglement.js";
import { notifierClient } from "../src/services/notifications.js";
import {
  ajouterPieceJointe,
  listerPiecesJointes,
  lirePieceJointe,
  TYPES_MIME_AUTORISES,
  TAILLE_MAX_OCTETS,
} from "../src/services/piecesJointes.js";

/**
 * Cas limites des services métier (§10 : cas nominal + cas limites).
 * Nécessite une base PostgreSQL accessible.
 */
describe("cas limites des services", () => {
  afterAll(async () => {
    await pool.end();
  });

  describe("règlement (US-E1)", () => {
    it("refuse un dossier inexistant", async () => {
      const resultat = await validerReglement({
        numeroDossier: "XX-0000-000000",
        montantIndemniteEur: 100,
        auteur: "test",
      });

      expect(resultat.ok).toBe(false);
      expect(resultat.erreur).toContain("introuvable");
    });
  });

  describe("pièces justificatives (US-A2)", () => {
    it("refuse un format non autorisé", async () => {
      const resultat = await ajouterPieceJointe({
        numeroDossier: "XX-0000-000000",
        nomFichier: "note.txt",
        typeMime: "text/plain",
        contenu: Buffer.from("contenu"),
      });

      expect(resultat.ok).toBe(false);
      expect(resultat.erreur).toContain("Format non accepté");
    });

    it("refuse un fichier dépassant la taille maximale", async () => {
      const resultat = await ajouterPieceJointe({
        numeroDossier: "XX-0000-000000",
        nomFichier: "gros.pdf",
        typeMime: "application/pdf",
        contenu: Buffer.alloc(TAILLE_MAX_OCTETS + 1),
      });

      expect(resultat.ok).toBe(false);
      expect(resultat.erreur).toContain("volumineux");
    });

    it("refuse une pièce rattachée à un dossier inexistant", async () => {
      const resultat = await ajouterPieceJointe({
        numeroDossier: "XX-0000-000000",
        nomFichier: "preuve.pdf",
        typeMime: "application/pdf",
        contenu: Buffer.from("%PDF-1.4"),
      });

      expect(resultat.ok).toBe(false);
      expect(resultat.erreur).toContain("introuvable");
    });

    it("retourne une liste vide pour un dossier inexistant", async () => {
      expect(await listerPiecesJointes("XX-0000-000000")).toEqual([]);
    });

    it("retourne null pour une pièce inexistante", async () => {
      expect(await lirePieceJointe("XX-0000-000000", "id-inexistant")).toBeNull();
    });

    it("n'autorise que les formats justificatifs attendus", () => {
      expect(TYPES_MIME_AUTORISES).toContain("application/pdf");
      expect(TYPES_MIME_AUTORISES).toContain("image/jpeg");
      expect(TYPES_MIME_AUTORISES).not.toContain("application/x-msdownload");
    });
  });

  describe("notifications (US-F1)", () => {
    it("ne notifie pas un dossier inexistant", async () => {
      expect(await notifierClient("XX-0000-000000", "accuseReception")).toBe(false);
    });
  });
});
