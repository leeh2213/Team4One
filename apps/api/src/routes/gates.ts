import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAgentForMember, requireBrain } from "../auth";

const ResultBody = z.object({
  status: z.enum(["PASSED", "FAILED"]),
  evidenceUrl: z.string().url().optional(),
});

const QaBody = z.object({
  status: z.enum(["PASSED", "FAILED"]),
  evidenceUrl: z.string().url(),
  memberId: z.string().min(1),
});

const ApprovalBody = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

function conflict(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 409 });
}

export async function registerGateRoutes(app: FastifyInstance) {
  app.post("/requirements/:requirementId/ci-result", async (request) => {
    requireBrain(request);
    const params = z.object({ requirementId: z.string() }).parse(request.params);
    const body = ResultBody.parse(request.body);

    const updated = await app.prisma.$transaction(async (tx) => {
      const gate = await tx.deploymentGate.update({
        where: { requirementId: params.requirementId },
        data: {
          ciStatus: body.status,
          evidenceUrl: body.evidenceUrl,
        },
        include: { requirement: true },
      });
      await tx.auditLog.create({
        data: {
          spaceId: gate.requirement.spaceId,
          actorType: "MEMBER",
          actorId: gate.requirement.createdByMemberId,
          action: "gate.ci_result_submitted",
          entityType: "Requirement",
          entityId: params.requirementId,
          payloadJson: JSON.stringify({
            status: body.status,
            evidenceUrl: body.evidenceUrl,
            gateId: gate.id,
          }),
        },
      });
      return gate;
    });
    const { requirement: updatedRequirement, ...gate } = updated;
    app.realtime?.publish({
      type: "gate.updated",
      spaceId: updatedRequirement.spaceId,
      requirementId: params.requirementId,
      gateStatus: updated.releaseStatus,
    });
    return gate;
  });

  app.post("/requirements/:requirementId/test-result", async (request, reply) => {
    const params = z.object({ requirementId: z.string() }).parse(request.params);
    const body = QaBody.parse(request.body);
    const agent = await requireAgentForMember(app.prisma, request, body.memberId);

    const requirement = await app.prisma.requirement.findUniqueOrThrow({
      where: { id: params.requirementId },
      include: { assignedMember: true },
    });

    if (requirement.assignedMemberId !== body.memberId) {
      return reply.code(403).send({ message: "QA result must come from assigned member" });
    }

    if (requirement.assignedMember?.role !== "QA") {
      return reply.code(403).send({ message: "test result must come from a QA member" });
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const gate = await tx.deploymentGate.update({
        where: { requirementId: params.requirementId },
        data: { testStatus: body.status },
        include: { requirement: true },
      });
      await tx.auditLog.create({
        data: {
          spaceId: requirement.spaceId,
          actorType: "AGENT",
          actorId: agent.id,
          action: "gate.test_result_submitted",
          entityType: "Requirement",
          entityId: params.requirementId,
          payloadJson: JSON.stringify({
            status: body.status,
            evidenceUrl: body.evidenceUrl,
            gateId: gate.id,
          }),
        },
      });
      return gate;
    });
    const { requirement: updatedRequirement, ...gate } = updated;
    app.realtime?.publish({
      type: "gate.updated",
      spaceId: updatedRequirement.spaceId,
      requirementId: params.requirementId,
      gateStatus: updated.releaseStatus,
    });
    return gate;
  });

  app.post("/requirements/:requirementId/command-approval", async (request) => {
    requireBrain(request);
    const params = z.object({ requirementId: z.string() }).parse(request.params);
    const body = ApprovalBody.parse(request.body);

    const updated = await app.prisma.$transaction(async (tx) => {
      const gate = await tx.deploymentGate.update({
        where: { requirementId: params.requirementId },
        data: { commandApprovalStatus: body.status },
        include: { requirement: true },
      });
      await tx.auditLog.create({
        data: {
          spaceId: gate.requirement.spaceId,
          actorType: "MEMBER",
          actorId: gate.requirement.createdByMemberId,
          action: "gate.command_approval_submitted",
          entityType: "Requirement",
          entityId: params.requirementId,
          payloadJson: JSON.stringify({ status: body.status, gateId: gate.id }),
        },
      });
      return gate;
    });
    const { requirement: updatedRequirement, ...gate } = updated;
    app.realtime?.publish({
      type: "gate.updated",
      spaceId: updatedRequirement.spaceId,
      requirementId: params.requirementId,
      gateStatus: updated.releaseStatus,
    });
    return gate;
  });

  app.post("/requirements/:requirementId/release", async (request, reply) => {
    requireBrain(request);
    const params = z.object({ requirementId: z.string() }).parse(request.params);
    const updated = await app.prisma.$transaction(async (tx) => {
      const gate = await tx.deploymentGate.findUniqueOrThrow({
        where: { requirementId: params.requirementId },
        include: { requirement: true },
      });

      if (
        gate.ciStatus !== "PASSED" ||
        gate.testStatus !== "PASSED" ||
        gate.commandApprovalStatus !== "APPROVED"
      ) {
        conflict("release gate is not satisfied");
      }

      const releaseAttempt = await tx.deploymentGate.updateMany({
        where: {
          requirementId: params.requirementId,
          ciStatus: "PASSED",
          testStatus: "PASSED",
          commandApprovalStatus: "APPROVED",
        },
        data: { releaseStatus: "RELEASED" },
      });
      if (releaseAttempt.count !== 1) {
        conflict("release gate is not satisfied");
      }

      await tx.requirement.update({
        where: { id: params.requirementId },
        data: { status: "RELEASED" },
      });
      await tx.auditLog.create({
        data: {
          spaceId: gate.requirement.spaceId,
          actorType: "MEMBER",
          actorId: gate.requirement.createdByMemberId,
          action: "requirement.released",
          entityType: "Requirement",
          entityId: params.requirementId,
          payloadJson: JSON.stringify({ gateId: gate.id }),
        },
      });

      const updated = await tx.deploymentGate.findUniqueOrThrow({
        where: { requirementId: params.requirementId },
        include: { requirement: true },
      });
      return updated;
    });
    const { requirement: updatedRequirement, ...gate } = updated;
    app.realtime?.publish({
      type: "gate.updated",
      spaceId: updatedRequirement.spaceId,
      requirementId: params.requirementId,
      gateStatus: updated.releaseStatus,
    });
    return gate;
  });
}
