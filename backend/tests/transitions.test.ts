import { describe, it, expect } from "vitest";
import {
  TRANSITIONS,
  STATUTS_DOSSIER,
  type StatutDossier,
} from "../src/models/dossierReclamation";

/** Petite fonction utilitaire : la transition est-elle autorisée ? */
function transitionAutorisee(de: StatutDossier, vers: StatutDossier): boolean {
  return TRANSITIONS[de].includes(vers);
}

describe("Machine à états du dossier de réclamation (US-D2)", () => {
  // --- Transitions du parcours nominal ---
  it("autorise le parcours nominal complet : recu → qualifie → en_traitement → proposition → resolu → cloture", () => {
    expect(transitionAutorisee("recu", "qualifie")).toBe(true);
    expect(transitionAutorisee("qualifie", "en_traitement")).toBe(true);
    expect(transitionAutorisee("en_traitement", "proposition")).toBe(true);
    expect(transitionAutorisee("proposition", "resolu")).toBe(true);
    expect(transitionAutorisee("resolu", "cloture")).toBe(true);
  });

  // --- Cas métier spécifiques ---
  it("autorise la clôture directe d'un dossier irrecevable (US-B2)", () => {
    expect(transitionAutorisee("qualifie", "cloture")).toBe(true);
  });

  it("autorise l'escalade depuis en_traitement et proposition (US-D3)", () => {
    expect(transitionAutorisee("en_traitement", "escalade")).toBe(true);
    expect(transitionAutorisee("proposition", "escalade")).toBe(true);
  });

  it("autorise la mise en attente de pièces puis le retour en qualification (US-A2)", () => {
    expect(transitionAutorisee("recu", "en_attente_pieces")).toBe(true);
    expect(transitionAutorisee("en_attente_pieces", "qualifie")).toBe(true);
  });

  // --- Transitions interdites ---
  it("interdit de sauter des étapes", () => {
    expect(transitionAutorisee("recu", "resolu")).toBe(false);
    expect(transitionAutorisee("recu", "cloture")).toBe(false);
    expect(transitionAutorisee("qualifie", "resolu")).toBe(false);
  });

  it("interdit de revenir en arrière depuis un état avancé", () => {
    expect(transitionAutorisee("resolu", "recu")).toBe(false);
    expect(transitionAutorisee("proposition", "recu")).toBe(false);
  });

  it("interdit toute sortie depuis cloture (état final)", () => {
    expect(TRANSITIONS.cloture).toHaveLength(0);
  });

  // --- Cohérence structurelle ---
  it("définit des transitions pour chaque statut existant", () => {
    for (const statut of STATUTS_DOSSIER) {
      expect(TRANSITIONS[statut]).toBeDefined();
    }
  });

  it("ne pointe que vers des statuts valides", () => {
    for (const statut of STATUTS_DOSSIER) {
      for (const cible of TRANSITIONS[statut]) {
        expect(STATUTS_DOSSIER).toContain(cible);
      }
    }
  });
});