import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashToken, requireActor, requireSpaceActor } from "../auth";

const MessageBody = z
  .object({
    senderMemberId: z.string().optional(),
    senderAgentId: z.string().optional(),
    requirementId: z.string().optional(),
    body: z.string().min(1),
    metadata: z.unknown().optional(),
  })
  .refine((body) => Boolean(body.senderMemberId) !== Boolean(body.senderAgentId), {
    message: "message must have exactly one sender",
  });

function forbidden(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 403 });
}

export async function registerMessageRoutes(app: FastifyInstance) {
  app.post("/conversations/:conversationId/messages", async (request, reply) => {
    const actor = requireActor(request);
    const params = z.object({ conversationId: z.string() }).parse(request.params);
    const body = MessageBody.parse(request.body);

    const conversation = await app.prisma.conversation.findUniqueOrThrow({
      where: { id: params.conversationId },
      include: { space: true },
    });

    if (body.requirementId) {
      const requirement = await app.prisma.requirement.findUniqueOrThrow({
        where: { id: body.requirementId },
      });
      if (requirement.spaceId !== conversation.spaceId) {
        forbidden("requirement does not belong to conversation space");
      }
    }

    let auditActor: { actorType: "MEMBER" | "AGENT"; actorId: string };
    if (actor.type === "BRAIN") {
      const senderMemberId = body.senderMemberId;
      if (!senderMemberId || senderMemberId !== conversation.space.commandBrainMemberId) {
        forbidden("command brain can only send as the space command brain member");
      }
      auditActor = { actorType: "MEMBER", actorId: senderMemberId };
    } else {
      if (!body.senderAgentId) {
        forbidden("agent messages must identify the sending agent");
      }

      const agent = await app.prisma.agentIdentity.findFirst({
        where: {
          id: body.senderAgentId,
          tokenHash: hashToken(actor.token),
          active: true,
        },
        include: {
          membership: true,
        },
      });
      if (!agent || agent.membership.spaceId !== conversation.spaceId) {
        forbidden("agent token does not have access to this conversation");
      }
      auditActor = { actorType: "AGENT", actorId: agent.id };
    }

    const message = await app.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId: params.conversationId,
          requirementId: body.requirementId,
          senderMemberId: body.senderMemberId,
          senderAgentId: body.senderAgentId,
          body: body.body,
          metadataJson: JSON.stringify(body.metadata ?? {}),
        },
      });
      await tx.auditLog.create({
        data: {
          spaceId: conversation.spaceId,
          actorType: auditActor.actorType,
          actorId: auditActor.actorId,
          action: "message.created",
          entityType: "Message",
          entityId: created.id,
          payloadJson: JSON.stringify({
            conversationId: params.conversationId,
            requirementId: body.requirementId,
          }),
        },
      });
      return created;
    });

    app.realtime?.publish({
      type: "message.created",
      spaceId: conversation.spaceId,
      conversationId: params.conversationId,
      messageId: message.id,
    });

    return reply.code(201).send(message);
  });

  app.get("/spaces/:spaceId/timeline", async (request) => {
    const params = z.object({ spaceId: z.string() }).parse(request.params);
    await requireSpaceActor(app.prisma, request, params.spaceId);

    return app.prisma.auditLog.findMany({
      where: { spaceId: params.spaceId },
      orderBy: { createdAt: "asc" },
    });
  });
}
