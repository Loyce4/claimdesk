import { describe, it, expect } from "vitest";
import { trouverRegle, appliquerRegle, evaluerRecevabilite } from "../src/rulesEngine/moteur.js";

describe("moteur de règles — qualification (US-B1, US-B3)", () => {
  it("trouve la règle applicable pour un cas connu", () => {
    const regle = trouverRegle("non_livraison", "FR");
    expect(regle).toBeDefined();
    expect(regle?.baseJuridique).toBe("Directive 2011/83/UE (droits des consommateurs)");
    expect(regle?.organeEscalade).toBe("Service logistique / Transporteur");
  });

  it("applique la règle générale aux sept pays du périmètre", () => {
    for (const pays of ["FR", "DE", "ES", "IT", "BE", "NL", "PL"]) {
      expect(trouverRegle("non_livraison", pays)).toBeDefined();
    }
  });

  it("ne retourne aucune règle pour un type inconnu (cas limite)", () => {
    expect(trouverRegle("type_inexistant", "FR")).toBeUndefined();
  });

  it("calcule correctement la date d'échéance", () => {
    const resultat = appliquerRegle({
      typeReclamation: "non_livraison",
      pays: "FR",
      dateDepot: new Date("2026-01-01"),
    });

    expect(resultat.baseJuridique).toBe("Directive 2011/83/UE (droits des consommateurs)");
    expect(resultat.delaiCibleJours).toBe(14);
    expect(resultat.dateEcheance?.toISOString().slice(0, 10)).toBe("2026-01-15");
  });

  it("applique le délai de 30 jours aux litiges de facturation", () => {
    const resultat = appliquerRegle({
      typeReclamation: "litige_facturation",
      pays: "IT",
      dateDepot: new Date("2026-01-01"),
    });

    expect(resultat.delaiCibleJours).toBe(30);
    expect(resultat.dateEcheance?.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("ne renseigne rien si aucune règle n'existe (cas limite)", () => {
    const resultat = appliquerRegle({
      typeReclamation: "type_inexistant" as never,
      pays: "FR",
      dateDepot: new Date("2026-01-01"),
    });

    expect(resultat.dateEcheance).toBeNull();
    expect(resultat.baseJuridique).toBeNull();
  });
});

describe("moteur de règles — recevabilité par pays (US-B2)", () => {
  const dateDepot = new Date("2026-07-30");

  it("accepte une réclamation dans le délai de garantie", () => {
    const resultat = evaluerRecevabilite({
      pays: "FR",
      dateAchat: new Date("2026-01-15"),
      dateDepot,
    });

    expect(resultat.recevable).toBe(true);
    expect(resultat.motifIrrecevabilite).toBeNull();
  });

  it("rejette une réclamation hors délai avec motivation", () => {
    const resultat = evaluerRecevabilite({
      pays: "FR",
      dateAchat: new Date("2022-01-15"),
      dateDepot,
    });

    expect(resultat.recevable).toBe(false);
    expect(resultat.motifIrrecevabilite).toContain("24 mois");
  });

  it("applique le droit national : 28 mois recevable en Espagne, prescrit en France", () => {
    const dateAchat = new Date("2024-03-10");

    expect(evaluerRecevabilite({ pays: "ES", dateAchat, dateDepot }).recevable).toBe(true);
    expect(evaluerRecevabilite({ pays: "FR", dateAchat, dateDepot }).recevable).toBe(false);
  });

  it("retient 26 mois pour l'Italie (2 ans + 2 mois de signalement)", () => {
    expect(evaluerRecevabilite({
      pays: "IT",
      dateAchat: new Date("2024-06-30"), // 25 mois
      dateDepot,
    }).recevable).toBe(true);

    expect(evaluerRecevabilite({
      pays: "IT",
      dateAchat: new Date("2024-04-30"), // 27 mois
      dateDepot,
    }).recevable).toBe(false);
  });

  it("ne se prononce pas pour un pays hors périmètre (cas limite)", () => {
    const resultat = evaluerRecevabilite({
      pays: "US",
      dateAchat: new Date("2026-01-15"),
      dateDepot,
    });

    expect(resultat.recevable).toBeNull();
  });
});