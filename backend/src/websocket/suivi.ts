/**
 * Suivi de cas en temps réel via WebSocket (imposé par le cahier des
 * charges — pas de polling ici).
 *
 * Un client se connecte sur /ws/reclamations/:numeroDossier et reçoit un
 * message chaque fois que ce dossier est mis à jour (changement de statut,
 * escalade, etc.), sans avoir à recharger la page.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { WebSocket } from "ws";

declare module "fastify" {
  interface FastifyInstance {
    publierMiseAJourDossier?: (numeroDossier: string, donnees: unknown) => void;
  }
}

export const websocketSuiviRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Abonnés par numéro de dossier : plusieurs onglets/clients peuvent
  // suivre le même dossier en même temps.
  const abonnes = new Map<string, Set<WebSocket>>();

  fastify.get(
    "/ws/reclamations/:numeroDossier",
    { websocket: true },
    (connection, request) => {
      const { numeroDossier } = request.params as { numeroDossier: string };

      if (!abonnes.has(numeroDossier)) {
        abonnes.set(numeroDossier, new Set());
      }
      abonnes.get(numeroDossier)!.add(connection.socket);

      connection.socket.send(
        JSON.stringify({ type: "connecte", numeroDossier })
      );

      connection.socket.on("close", () => {
        abonnes.get(numeroDossier)?.delete(connection.socket);
      });
    }
  );

  // Exposé aux routes REST pour diffuser une mise à jour de dossier dès
  // qu'elle se produit (dépôt, changement de statut, escalade...).
  fastify.decorate(
    "publierMiseAJourDossier",
    (numeroDossier: string, donnees: unknown) => {
      const sockets = abonnes.get(numeroDossier);
      if (!sockets) return;

      const message = JSON.stringify({ type: "misAJour", donnees });
      for (const socket of sockets) {
        if (socket.readyState === socket.OPEN) {
          socket.send(message);
        }
      }
    }
  );
};
