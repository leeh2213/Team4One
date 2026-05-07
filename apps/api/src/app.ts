import cors from "@fastify/cors";
import Fastify from "fastify";
import type { PrismaClient } from "@prisma/client";
import { createAudit } from "./audit";
import { registerErrorHandler } from "./errors";
import { registerGateRoutes } from "./routes/gates";
import { registerMessageRoutes } from "./routes/messages";
import { registerRequirementRoutes } from "./routes/requirements";
import { registerSpaceRoutes } from "./routes/spaces";

export type AppServices = {
  prisma: PrismaClient;
};

export async function buildApp(services: AppServices) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.decorate("prisma", services.prisma);
  app.decorate("audit", createAudit(services.prisma));
  registerErrorHandler(app);

  app.get("/health", async () => ({ ok: true }));
  await registerSpaceRoutes(app);
  await registerRequirementRoutes(app);
  await registerMessageRoutes(app);
  await registerGateRoutes(app);

  return app;
}
