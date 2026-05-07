import type { PrismaClient } from "@prisma/client";
import type { RealtimeEvent } from "@team4one/shared";
import type { AuditService } from "./audit.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    audit: AuditService;
    realtime?: {
      publish(event: RealtimeEvent): void;
    };
  }
}
