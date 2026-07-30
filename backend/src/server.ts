import "dotenv/config";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocketPlugin from "@fastify/websocket";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";

import { initDatabase } from "./db/pool.js";
import { depotRoutes } from "./routes/depot.js";
import { websocketSuiviRoutes } from "./websocket/suivi.js";
import { demarrerPlanificateur } from "./services/planificateur.js";

async function main() {
  const fastify = Fastify({ logger: true });

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "ClaimDesk API",
        version: "0.1.0",
      },
    },
    transform: jsonSchemaTransform,
  });
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
  });

  await fastify.register(websocketPlugin);

  fastify.get("/health", async () => ({ status: "ok" }));

  await fastify.register(websocketSuiviRoutes);
  await fastify.register(depotRoutes);

  await initDatabase();

  demarrerPlanificateur(fastify);

  const port = Number(process.env.BACKEND_PORT ?? 8000);
  await fastify.listen({ host: "0.0.0.0", port });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
