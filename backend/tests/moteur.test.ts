import { describe, it, expect } from "vitest";
import { trouverRegle, appliquerRegle } from "../src/rulesEngine/moteur.js";

describe("moteur de règles", () => {
  it("trouve la règle pour un cas connu", () => {
    const regle = trouverRegle("non_livraison", "FR");
    expect(regle).toBeDefined();
    expect(regle?.organeEscalade).toBe("Médiateur de la consommation");
  });

  it("ne retourne aucune règle pour un pays non couvert (cas limite)", () => {
    // Ne doit pas lancer d'exception, doit juste retourner undefined —
    // pour ne jamais bloquer le dépôt côté client.
    const regle = trouverRegle("non_livraison", "PL");
    expect(regle).toBeUndefined();
  });

  it("calcule correctement la date d'échéance", () => {
    const resultat = appliquerRegle({
      typeReclamation: "non_livraison",
      pays: "FR",
      dateDepot: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(resultat.baseJuridique).toBe("Code de la consommation, art. L216-1");
    expect(resultat.dateEcheance?.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("ne renseigne rien si aucune règle n'existe (cas limite)", () => {
    const resultat = appliquerRegle({
      typeReclamation: "retractation",
      pays: "PL",
      dateDepot: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(resultat.dateEcheance).toBeNull();
    expect(resultat.baseJuridique).toBeNull();
  });
});
