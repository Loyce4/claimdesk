import { describe, it, expect } from "vitest";
import { genererCourrier } from "../src/services/courriers.js";

describe("génération de courriers", () => {
  it("génère le courrier en français avec les bonnes variables", () => {
    const texte = genererCourrier(
      {
        numeroDossier: "FR-2026-000001",
        nomClient: "Marie Dupont",
        dateDepot: "2026-07-23",
      },
      "fr"
    );

    expect(texte).toContain("FR-2026-000001");
    expect(texte).toContain("Marie Dupont");
  });

  it("retombe sur le français si la langue n'a pas encore de template (cas limite)", () => {
    const texte = genererCourrier(
      {
        numeroDossier: "DE-2026-000001",
        nomClient: "Hans Müller",
        dateDepot: "2026-07-23",
      },
      "de"
    );

    expect(texte).toContain("DE-2026-000001");
  });
});
