import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import multipart from "@fastify/multipart";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { pool } from "../src/db/pool.js";
import { depotRoutes } from "../src/routes/depot.js";
import { websocketSuiviRoutes } from "../src/websocket/suivi.js";
import { escaladerDossiersEnRetard } from "../src/services/escalade.js";

/**
 * Test d'intégration du parcours complet (§10 du cahier des charges) :
 * dépôt → qualification → courrier → suivi → règlement.
 *
 * Nécessite une base PostgreSQL accessible (docker compose up -d db).
 */
describe("parcours complet d'une réclamation", () => {
  let app: FastifyInstance;
  let numeroDossier: string;

  beforeAll(async () => {
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(websocketPlugin);
    await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
    await app.register(websocketSuiviRoutes);
    await app.register(depotRoutes);
    await app.ready();
  });

  afterAll(async () => {
    if (numeroDossier) {
      await pool.query(
        `DELETE FROM envois_courriers WHERE numero_dossier = $1`,
        [numeroDossier]
      );
      await pool.query(
        `DELETE FROM dossiers_reclamation WHERE numero_dossier = $1`,
        [numeroDossier]
      );
    }
    await app.close();
    await pool.end();
  });

  it("1. dépose une réclamation et la qualifie automatiquement", async () => {
    const reponse = await app.inject({
      method: "POST",
      url: "/reclamations",
      payload: {
        pays: "ES",
        typeReclamation: "produit_non_conforme",
        description: "Test d'integration du parcours complet de bout en bout.",
        nomClient: "Integration Test",
        emailClient: "integration@example.com",
        referenceCommande: "CMD-INT-0001",
        dateAchat: "2025-06-01",
        montantReclame: 150,
      },
    });

    expect(reponse.statusCode).toBe(201);
    const dossier = reponse.json();

    numeroDossier = dossier.numeroDossier;
    expect(numeroDossier).toMatch(/^ES-\d{4}-\d{6}$/);
    expect(dossier.statut).toBe("recu");
    expect(dossier.langue).toBe("es"); // déduite du pays (US-C2)
    expect(dossier.baseJuridique).toBeTruthy(); // qualifié (US-B1)
    expect(dossier.delaiCibleJours).toBe(14); // remède et délai (US-B3)
    expect(dossier.dateEcheance).toBeTruthy();
    expect(dossier.recevable).toBe(true); // 14 mois < 36 mois en Espagne (US-B2)
  });

  it("2. refuse un dépôt incomplet", async () => {
    const reponse = await app.inject({
      method: "POST",
      url: "/reclamations",
      payload: {
        pays: "ES",
        typeReclamation: "produit_non_conforme",
        description: "Dossier sans reference de commande ni date d'achat.",
        nomClient: "Incomplet",
        emailClient: "incomplet@example.com",
      },
    });

    expect(reponse.statusCode).toBe(400);
  });

  it("3. envoie l'accusé de réception dans la langue du client", async () => {
    const reponse = await app.inject({
      method: "GET",
      url: `/reclamations/${numeroDossier}/envois`,
    });

    const envois = reponse.json();
    const accuse = envois.find((e: any) => e.typeCourrier === "accuseReception");

    expect(accuse).toBeDefined();
    expect(accuse.langue).toBe("es");
    expect(accuse.destinataire).toBe("integration@example.com");
  });

  it("4. accepte une pièce justificative au bon format", async () => {
    // Un PNG minimal valide (1x1 pixel transparent)
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64"
    );

    const frontiere = "----test";
    const corps = Buffer.concat([
      Buffer.from(
        `--${frontiere}\r\nContent-Disposition: form-data; name="fichier"; filename="preuve.png"\r\nContent-Type: image/png\r\n\r\n`
      ),
      png,
      Buffer.from(`\r\n--${frontiere}--\r\n`),
    ]);

    const reponse = await app.inject({
      method: "POST",
      url: `/reclamations/${numeroDossier}/pieces`,
      headers: { "content-type": `multipart/form-data; boundary=${frontiere}` },
      payload: corps,
    });

    expect(reponse.statusCode).toBe(201);
    expect(reponse.json().typeMime).toBe("image/png");
  });

  it("5. escalade le dossier en cas de dépassement de délai", async () => {
    await pool.query(
      `UPDATE dossiers_reclamation SET date_echeance = CURRENT_DATE - 1
        WHERE numero_dossier = $1`,
      [numeroDossier]
    );

    const escalades = await escaladerDossiersEnRetard();
    expect(escalades.some((e) => e.numeroDossier === numeroDossier)).toBe(true);

    const reponse = await app.inject({
      method: "GET",
      url: `/reclamations/${numeroDossier}`,
    });
    expect(reponse.json().statut).toBe("escalade");
  }, 30000);

  it("6. valide le règlement et clôt le parcours", async () => {
    const reponse = await app.inject({
      method: "POST",
      url: `/reclamations/${numeroDossier}/reglement`,
      payload: { montantIndemniteEur: 150, auteur: "test.integration" },
    });

    expect(reponse.statusCode).toBe(200);
    const dossier = reponse.json();
    expect(dossier.statut).toBe("resolu");
    expect(dossier.montantIndemniteEur).toBe(150);
    expect(dossier.delaiTraitementJours).toBeGreaterThanOrEqual(0);
  });

  it("7. conserve la trace de tous les courriers envoyés", async () => {
    const reponse = await app.inject({
      method: "GET",
      url: `/reclamations/${numeroDossier}/envois`,
    });

    const types = reponse.json().map((e: any) => e.typeCourrier);
    expect(types).toContain("accuseReception");
    expect(types).toContain("escalade");
    expect(types).toContain("notificationReglement");
  });
});