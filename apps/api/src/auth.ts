import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { config } from "./config";

export type Actor = {
  type: "BRAIN" | "AGENT" | "VIEWER";
  token: string;
};

export function hashToken(token: string): string {
  return `mvp:${createHash("sha256").update(token).digest("base64url")}`;
}

export function requireActor(request: FastifyRequest): Actor {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (token === config.DEV_BRAIN_TOKEN) {
    return { type: "BRAIN", token };
  }

  if (token === config.DEV_AGENT_TOKEN || token.length > 0) {
    return { type: "AGENT", token };
  }

  throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
}

export function requireBrain(request: FastifyRequest): Actor {
  const actor = requireActor(request);
  if (actor.type !== "BRAIN") {
    throw Object.assign(new Error("Only command brain can perform this action"), {
      statusCode: 403,
    });
  }
  return actor;
}

export async function requireAgentForMember(
  prisma: PrismaClient,
  request: FastifyRequest,
  memberId: string,
) {
  const actor = requireActor(request);
  if (actor.type !== "AGENT") {
    throw Object.assign(new Error("Only an assigned member agent can perform this action"), {
      statusCode: 403,
    });
  }

  const agent = await prisma.agentIdentity.findFirst({
    where: {
      tokenHash: hashToken(actor.token),
      active: true,
    },
  });

  if (!agent || agent.membershipId !== memberId) {
    throw Object.assign(new Error("agent token does not match member responsibility"), {
      statusCode: 403,
    });
  }

  return agent;
}

export async function requireSpaceActor(
  prisma: PrismaClient,
  request: FastifyRequest,
  spaceId: string,
) {
  const actor = requireActor(request);
  if (actor.type === "BRAIN") {
    return actor;
  }

  const agent = await prisma.agentIdentity.findFirst({
    where: {
      tokenHash: hashToken(actor.token),
      active: true,
    },
    include: {
      membership: true,
    },
  });

  if (!agent || agent.membership.spaceId !== spaceId) {
    const space = await prisma.projectSpace.findFirst({
      where: {
        id: spaceId,
        viewerTokenHash: hashToken(actor.token),
      },
    });

    if (space) {
      return { type: "VIEWER" as const, token: actor.token };
    }

    throw Object.assign(new Error("token does not have access to this space"), {
      statusCode: 403,
    });
  }

  return { ...actor, agent };
}
