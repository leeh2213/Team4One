import type { FastifyInstance } from "fastify";
import { RequirementStatusSchema, canTransitionRequirement } from "@team4one/shared";
import { z } from "zod";
import { requireActor, requireAgentForMember, requireBrain } from "../auth";

const CreateRequirementBody = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  assignedMemberId: z.string().min(1),
  acceptanceCriteria: z.string().min(1),
  branchName: z.string().optional(),
});

const StatusBody = z.object({
  memberId: z.string().min(1),
  status: RequirementStatusSchema,
});

export async function registerRequirementRoutes(app: FastifyInstance) {
  app.post("/spaces/:spaceId/requirements", async (request, reply) => {
    requireBrain(request);
    const params = z.object({ spaceId: z.string() }).parse(request.params);
    const body = CreateRequirementBody.parse(request.body);

    const space = await app.prisma.projectSpace.findUniqueOrThrow({
      where: { id: params.spaceId },
    });
    if (!space.commandBrainMemberId) {
      return reply.code(409).send({ message: "space has no command brain" });
    }
    const commandBrainMemberId = space.commandBrainMemberId;

    const assignedMember = await app.prisma.membership.findFirst({
      where: { id: body.assignedMemberId, spaceId: params.spaceId },
    });
    if (!assignedMember) {
      return reply.code(400).send({ message: "assigned member must belong to space" });
    }

    const requirement = await app.prisma.$transaction(async (tx) => {
      const created = await tx.requirement.create({
        data: {
          spaceId: params.spaceId,
          title: body.title,
          description: body.description,
          status: "ASSIGNED",
          createdByMemberId: commandBrainMemberId,
          assignedMemberId: body.assignedMemberId,
          acceptanceCriteria: body.acceptanceCriteria,
          branchName: body.branchName,
          gate: { create: {} },
        },
      });
      await tx.auditLog.create({
        data: {
          spaceId: params.spaceId,
          actorType: "MEMBER",
          actorId: commandBrainMemberId,
          action: "requirement.assigned",
          entityType: "Requirement",
          entityId: created.id,
          payloadJson: JSON.stringify({
            assignedMemberId: body.assignedMemberId,
            branchName: body.branchName,
          }),
        },
      });
      return created;
    });

    return reply.code(201).send(requirement);
  });

  app.patch("/requirements/:requirementId/status", async (request, reply) => {
    const actor = requireActor(request);
    const params = z.object({ requirementId: z.string() }).parse(request.params);
    const body = StatusBody.parse(request.body);

    const current = await app.prisma.requirement.findUniqueOrThrow({
      where: { id: params.requirementId },
    });

    const isBrain = actor.type === "BRAIN";
    let verifiedAgentId: string | undefined;
    if (!isBrain) {
      const verifiedAgent = await requireAgentForMember(app.prisma, request, body.memberId);
      verifiedAgentId = verifiedAgent.id;
    }

    const isAssignedMember = current.assignedMemberId === body.memberId;
    if (!isBrain && !isAssignedMember) {
      return reply.code(403).send({ message: "cannot update work outside your responsibility" });
    }

    const currentStatus = RequirementStatusSchema.parse(current.status);
    if (!canTransitionRequirement(currentStatus, body.status)) {
      return reply.code(409).send({
        message: `invalid transition from ${currentStatus} to ${body.status}`,
      });
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const requirement = await tx.requirement.update({
        where: { id: current.id },
        data: { status: body.status },
      });
      await tx.auditLog.create({
        data: {
          spaceId: current.spaceId,
          actorType: actor.type === "BRAIN" ? "MEMBER" : "AGENT",
          actorId: actor.type === "BRAIN" ? current.createdByMemberId : verifiedAgentId!,
          action: "requirement.status_changed",
          entityType: "Requirement",
          entityId: current.id,
          payloadJson: JSON.stringify({ from: currentStatus, to: body.status }),
        },
      });
      return requirement;
    });

    app.realtime?.publish({
      type: "requirement.updated",
      spaceId: current.spaceId,
      requirementId: current.id,
      status: RequirementStatusSchema.parse(updated.status),
    });

    return updated;
  });
}
