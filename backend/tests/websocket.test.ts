import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import WebSocket from "ws";
import { websocketSuiviRoutes } from "../src/websocket/suivi.js";

describe("suivi temps réel des dossiers (US-D1)", () => {
  let app: FastifyInstance;
  let port: number;

  beforeAll(async () => {
    app = Fastify();
    await app.register(websocketPlugin);
    await app.register(websocketSuiviRoutes);
    await app.listen({ port: 0, host: "127.0.0.1" });
    port = (app.server.address() as { port: number }).port;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Ouvre une connexion et collecte les messages reçus. */
  function connecter(numeroDossier: string) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/reclamations/${numeroDossier}`);
    const messages: Array<Record<string, unknown>> = [];
    ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
    return { ws, messages };
  }

  function attendre(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  it("expose la fonction de diffusion à toute l'application", () => {
    // Vérifie que la décoration franchit l'encapsulation Fastify (fastify-plugin)
    expect(app.publierMiseAJourDossier).toBeTypeOf("function");
  });

  it("confirme l'abonnement à la connexion", async () => {
    const { ws, messages } = connecter("FR-2026-000001");
    await attendre(300);

    expect(messages[0]).toEqual({ type: "connecte", numeroDossier: "FR-2026-000001" });
    ws.close();
  });

  it("pousse les mises à jour du dossier sans rechargement", async () => {
    const { ws, messages } = connecter("FR-2026-000002");
    await attendre(300);

    app.publierMiseAJourDossier?.("FR-2026-000002", { statut: "escalade" });
    await attendre(300);

    const misAJour = messages.filter((m) => m.type === "misAJour");
    expect(misAJour).toHaveLength(1);
    expect(misAJour[0].donnees).toEqual({ statut: "escalade" });
    ws.close();
  });

  it("n'expose qu'au dossier concerné (cloisonnement, US-A4)", async () => {
    const a = connecter("FR-2026-000003");
    const b = connecter("FR-2026-000004");
    await attendre(300);

    app.publierMiseAJourDossier?.("FR-2026-000003", { statut: "resolu" });
    await attendre(300);

    expect(a.messages.filter((m) => m.type === "misAJour")).toHaveLength(1);
    expect(b.messages.filter((m) => m.type === "misAJour")).toHaveLength(0);

    a.ws.close();
    b.ws.close();
  });

  it("diffuse à tous les abonnés d'un même dossier", async () => {
    const onglet1 = connecter("FR-2026-000005");
    const onglet2 = connecter("FR-2026-000005");
    await attendre(300);

    app.publierMiseAJourDossier?.("FR-2026-000005", { statut: "proposition" });
    await attendre(300);

    expect(onglet1.messages.filter((m) => m.type === "misAJour")).toHaveLength(1);
    expect(onglet2.messages.filter((m) => m.type === "misAJour")).toHaveLength(1);

    onglet1.ws.close();
    onglet2.ws.close();
  });
});