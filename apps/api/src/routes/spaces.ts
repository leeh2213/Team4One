import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { AgentHarnessSchema, MemberRoleSchema } from "@team4one/shared";
import { z } from "zod";
import { hashToken, requireBrain, requireSpaceActor } from "../auth";

const CreateSpaceBody = z.object({
  name: z.string().min(1),
  commandBrain: z.object({
    displayName: z.string().min(1),
    email: z.string().email(),
  }),
});

const RegisterAgentBody = z.object({
  member: z.object({
    displayName: z.string().min(1),
    email: z.string().email(),
    role: MemberRoleSchema,
  }),
  agent: z.object({
    harness: AgentHarnessSchema,
    displayName: z.string().min(1),
    token: z.string().min(8),
  }),
});

function toAgentResponse(agent: {
  id: string;
  membershipId: string;
  harness: string;
  displayName: string;
  active: boolean;
  createdAt: Date;
}) {
  return {
    id: agent.id,
    membershipId: agent.membershipId,
    harness: agent.harness,
    displayName: agent.displayName,
    active: agent.active,
    createdAt: agent.createdAt,
  };
}

function toMembershipResponse(membership: {
  id: string;
  spaceId: string;
  userId: string;
  role: string;
  createdAt: Date;
  user?: {
    id: string;
    displayName: string;
    email: string;
    createdAt: Date;
  };
  agent?: {
    id: string;
    membershipId: string;
    harness: string;
    displayName: string;
    active: boolean;
    createdAt: Date;
  } | null;
}) {
  return {
    id: membership.id,
    spaceId: membership.spaceId,
    userId: membership.userId,
    role: membership.role,
    createdAt: membership.createdAt,
    user: membership.user,
    agent: membership.agent ? toAgentResponse(membership.agent) : null,
  };
}

function toRequirementResponse(requirement: {
  id: string;
  spaceId: string;
  title: string;
  description: string;
  status: string;
  createdByMemberId: string;
  assignedMemberId: string | null;
  acceptanceCriteria: string;
  branchName: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedMember?: Parameters<typeof toMembershipResponse>[0] | null;
  gate?: {
    id: string;
    requirementId: string;
    ciStatus: string;
    testStatus: string;
    commandApprovalStatus: string;
    releaseStatus: string;
    evidenceUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}) {
  return {
    id: requirement.id,
    spaceId: requirement.spaceId,
    title: requirement.title,
    description: requirement.description,
    status: requirement.status,
    createdByMemberId: requirement.createdByMemberId,
    assignedMemberId: requirement.assignedMemberId,
    acceptanceCriteria: requirement.acceptanceCriteria,
    branchName: requirement.branchName,
    createdAt: requirement.createdAt,
    updatedAt: requirement.updatedAt,
    assignedMember: requirement.assignedMember
      ? toMembershipResponse(requirement.assignedMember)
      : null,
    gate: requirement.gate,
  };
}

function toMessageResponse(message: {
  id: string;
  conversationId: string;
  requirementId: string | null;
  senderMemberId: string | null;
  senderAgentId: string | null;
  body: string;
  metadataJson: string;
  createdAt: Date;
  senderMember?: Parameters<typeof toMembershipResponse>[0] | null;
  senderAgent?: {
    id: string;
    membershipId: string;
    harness: string;
    displayName: string;
    active: boolean;
    createdAt: Date;
  } | null;
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    requirementId: message.requirementId,
    senderMemberId: message.senderMemberId,
    senderAgentId: message.senderAgentId,
    body: message.body,
    metadataJson: message.metadataJson,
    createdAt: message.createdAt,
    senderMember: message.senderMember ? toMembershipResponse(message.senderMember) : null,
    senderAgent: message.senderAgent ? toAgentResponse(message.senderAgent) : null,
  };
}

function toConversationResponse(conversation: {
  id: string;
  spaceId: string;
  topic: string;
  scopeType: string;
  requirementId: string | null;
  createdAt: Date;
  messages: Parameters<typeof toMessageResponse>[0][];
}) {
  return {
    id: conversation.id,
    spaceId: conversation.spaceId,
    topic: conversation.topic,
    scopeType: conversation.scopeType,
    requirementId: conversation.requirementId,
    createdAt: conversation.createdAt,
    messages: conversation.messages.map(toMessageResponse),
  };
}

export async function registerSpaceRoutes(app: FastifyInstance) {
  app.post("/spaces", async (request, reply) => {
    requireBrain(request);
    const body = CreateSpaceBody.parse(request.body);
    const viewerToken = `viewer_${randomUUID()}`;

    const result = await app.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: body.commandBrain.email },
        create: body.commandBrain,
        update: { displayName: body.commandBrain.displayName },
      });
      const space = await tx.projectSpace.create({
        data: { name: body.name, viewerTokenHash: hashToken(viewerToken) },
      });
      const membership = await tx.membership.create({
        data: { userId: user.id, spaceId: space.id, role: "COMMAND_BRAIN" },
      });
      const updated = await tx.projectSpace.update({
        where: { id: space.id },
        data: { commandBrainMemberId: membership.id },
      });
      await tx.conversation.create({
        data: { spaceId: space.id, topic: "Project Room", scopeType: "GLOBAL" },
      });
      await tx.auditLog.create({
        data: {
          spaceId: space.id,
          actorType: "MEMBER",
          actorId: membership.id,
          action: "space.created",
          entityType: "ProjectSpace",
          entityId: space.id,
          payloadJson: JSON.stringify({ name: body.name }),
        },
      });
      return updated;
    });
    const { viewerTokenHash: _viewerTokenHash, ...space } = result;

    return reply.code(201).send({ ...space, viewerToken });
  });

  app.post("/spaces/:spaceId/agents", async (request, reply) => {
    requireBrain(request);
    const params = z.object({ spaceId: z.string() }).parse(request.params);
    const body = RegisterAgentBody.parse(request.body);

    const space = await app.prisma.projectSpace.findUniqueOrThrow({
      where: { id: params.spaceId },
    });
    if (body.member.role === "COMMAND_BRAIN" && space.commandBrainMemberId) {
      return reply.code(409).send({ message: "space already has a command brain" });
    }

    const result = await app.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: body.member.email },
        create: {
          displayName: body.member.displayName,
          email: body.member.email,
        },
        update: { displayName: body.member.displayName },
      });
      const membership = await tx.membership.create({
        data: {
          spaceId: params.spaceId,
          userId: user.id,
          role: body.member.role,
        },
      });
      const agent = await tx.agentIdentity.create({
        data: {
          membershipId: membership.id,
          harness: body.agent.harness,
          displayName: body.agent.displayName,
          tokenHash: hashToken(body.agent.token),
        },
      });
      await tx.auditLog.create({
        data: {
          spaceId: params.spaceId,
          actorType: "MEMBER",
          actorId: space.commandBrainMemberId ?? "unknown",
          action: "agent.registered",
          entityType: "AgentIdentity",
          entityId: agent.id,
          payloadJson: JSON.stringify({
            role: body.member.role,
            harness: body.agent.harness,
          }),
        },
      });
      return { membership, agent: toAgentResponse(agent) };
    });

    return reply.code(201).send(result);
  });

  app.get("/spaces/:spaceId", async (request) => {
    const params = z.object({ spaceId: z.string() }).parse(request.params);
    await requireSpaceActor(app.prisma, request, params.spaceId);
    const space = await app.prisma.projectSpace.findUniqueOrThrow({
      where: { id: params.spaceId },
      include: {
        memberships: {
          include: { user: true, agent: true },
          orderBy: { createdAt: "asc" },
        },
        requirements: {
          include: {
            assignedMember: {
              include: { user: true, agent: true },
            },
            gate: true,
          },
          orderBy: { createdAt: "asc" },
        },
        conversations: {
          include: {
            messages: {
              include: {
                senderMember: {
                  include: { user: true, agent: true },
                },
                senderAgent: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const { viewerTokenHash: _viewerTokenHash, ...spaceResponse } = space;

    return {
      ...spaceResponse,
      memberships: space.memberships.map(toMembershipResponse),
      requirements: space.requirements.map(toRequirementResponse),
      conversations: space.conversations.map(toConversationResponse),
    };
  });
}
