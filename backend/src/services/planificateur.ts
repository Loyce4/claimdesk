/**
 * Planificateur applicatif simple (§7 : pas de broker de messages).
 * Vérifie périodiquement les dépassements de délai.
 */

import type { FastifyInstance } from "fastify";
import { escaladerDossiersEnRetard } from "./escalade.js";
import { notifierClient } from "./notifications.js";
const INTERVALLE_MS = 60 * 60 * 1000; // toutes les heures

export function demarrerPlanificateur(fastify: FastifyInstance): void {
  const executer = async () => {
    try {
      const escalades = await escaladerDossiersEnRetard();
      if (escalades.length > 0) {
        fastify.log.info(
          { nombre: escalades.length },
          "Dossiers escaladés automatiquement"
        );
        for (const dossier of escalades) {
          fastify.publierMiseAJourDossier?.(dossier.numeroDossier, {
            numeroDossier: dossier.numeroDossier,
            statut: "escalade",
            organeEscalade: dossier.organeEscalade,
          });
          await notifierClient(dossier.numeroDossier, "escalade");
        }
      }
    } catch (err) {
      fastify.log.error(err, "Échec du contrôle des dépassements de délai");
    }
  };

  void executer(); // premier passage au démarrage
  const timer = setInterval(executer, INTERVALLE_MS);
  fastify.addHook("onClose", async () => clearInterval(timer));
}