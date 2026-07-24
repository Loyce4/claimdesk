import { describe, it, expect, beforeEach, vi } from "vitest";
import { synchroniserVersOdoo } from "../src/services/odoo.js";

describe("intégration Odoo", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("retourne false sans lever d'exception si Odoo n'est pas configuré", async () => {
    // Cas limite volontaire : environnement de dev sans accès ERP -> le
    // dépôt de réclamation ne doit jamais être bloqué par Odoo.
    vi.stubEnv("ODOO_URL", "");
    vi.stubEnv("ODOO_DB", "");

    const resultat = await synchroniserVersOdoo({
      numeroDossier: "FR-2026-000001",
      pays: "FR",
      typeReclamation: "non_livraison",
      description: "Test",
      nomClient: "Client Test",
      emailClient: "client@example.com",
      montantReclame: 10,
      statut: "depose",
      dateEcheance: null,
    });

    expect(resultat).toBe(false);
  });

  it("retourne false (sans exception) si Odoo est injoignable", async () => {
    vi.stubEnv("ODOO_URL", "http://odoo-inexistant.invalid");
    vi.stubEnv("ODOO_DB", "claimdesk");
    vi.stubEnv("ODOO_USERNAME", "test");
    vi.stubEnv("ODOO_API_KEY", "test");

    const resultat = await synchroniserVersOdoo({
      numeroDossier: "FR-2026-000002",
      pays: "FR",
      typeReclamation: "non_livraison",
      description: "Test",
      nomClient: "Client Test",
      emailClient: "client@example.com",
      montantReclame: 10,
      statut: "depose",
      dateEcheance: null,
    });

    expect(resultat).toBe(false);
  });
});
