import type { PrismaClient } from "@prisma/client";

export type AuditInput = {
  spaceId: string;
  actorType: "MEMBER" | "AGENT" | "SYSTEM";
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
};

export function createAudit(prisma: PrismaClient) {
  return {
    append(input: AuditInput) {
      const { payload, ...data } = input;

      return prisma.auditLog.create({
        data: {
          ...data,
          payloadJson: JSON.stringify(payload ?? {}),
        },
      });
    },
  };
}

export type AuditService = ReturnType<typeof createAudit>;
