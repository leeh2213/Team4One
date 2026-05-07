import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers";

type TestApp = Awaited<ReturnType<typeof createTestApp>>["app"];
type TestPrisma = Awaited<ReturnType<typeof createTestApp>>["prisma"];

async function createSpace(app: TestApp) {
  const spaceResponse = await app.inject({
    method: "POST",
    url: "/spaces",
    headers: { authorization: "Bearer brain-local-token" },
    payload: {
      name: "Release",
      commandBrain: { displayName: "PM", email: "pm@example.com" },
    },
  });

  return spaceResponse.json();
}

async function registerQa(app: TestApp, spaceId: string, suffix = "") {
  const agentResponse = await app.inject({
    method: "POST",
    url: `/spaces/${spaceId}/agents`,
    headers: { authorization: "Bearer brain-local-token" },
    payload: {
      member: {
        displayName: `QA${suffix}`,
        email: `qa${suffix.toLowerCase()}@example.com`,
        role: "QA",
      },
      agent: {
        harness: "OPENCODE",
        displayName: `QA Agent${suffix}`,
        token: `qa-agent-token${suffix}`,
      },
    },
  });

  return agentResponse.json();
}

async function registerBackend(app: TestApp, spaceId: string) {
  const agentResponse = await app.inject({
    method: "POST",
    url: `/spaces/${spaceId}/agents`,
    headers: { authorization: "Bearer brain-local-token" },
    payload: {
      member: {
        displayName: "Backend",
        email: "backend@example.com",
        role: "BACKEND",
      },
      agent: {
        harness: "CODEX",
        displayName: "Backend Agent",
        token: "backend-agent-token",
      },
    },
  });

  return agentResponse.json();
}

async function createReleaseRequirement(
  prisma: TestPrisma,
  space: { id: string; commandBrainMemberId: string },
  assignedMemberId: string,
) {
  return prisma.requirement.create({
    data: {
      spaceId: space.id,
      title: "Deployable feature",
      description: "A feature ready for release",
      status: "CI_PASSED",
      createdByMemberId: space.commandBrainMemberId,
      assignedMemberId,
      acceptanceCriteria: "QA and CI pass",
      gate: { create: {} },
    },
  });
}

async function seedReleaseRequirement(app: TestApp, prisma: TestPrisma) {
  const space = await createSpace(app);
  const qa = await registerQa(app, space.id);
  const requirement = await createReleaseRequirement(prisma, space, qa.membership.id);

  return { space, qa, requirement };
}

describe("release gates", () => {
  it("requires CI, QA, and command approval before release", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const { space, qa, requirement } = await seedReleaseRequirement(app, prisma);
      const qaEvidenceUrl = "https://qa.example/run/1";

      const blockedRelease = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/release`,
        headers: { authorization: "Bearer brain-local-token" },
      });
      expect(blockedRelease.statusCode).toBe(409);

      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/ci-result`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: { status: "PASSED", evidenceUrl: "https://ci.example/run/1" },
      });
      const testResult = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/test-result`,
        headers: { authorization: "Bearer qa-agent-token" },
        payload: {
          memberId: qa.membership.id,
          status: "PASSED",
          evidenceUrl: qaEvidenceUrl,
        },
      });
      expect(testResult.statusCode).toBe(200);
      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/command-approval`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: { status: "APPROVED" },
      });

      const released = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/release`,
        headers: { authorization: "Bearer brain-local-token" },
      });

      expect(released.statusCode).toBe(200);
      expect(released.json().releaseStatus).toBe("RELEASED");

      const storedRequirement = await prisma.requirement.findUniqueOrThrow({
        where: { id: requirement.id },
      });
      expect(storedRequirement.status).toBe("RELEASED");

      const qaAudit = await prisma.auditLog.findFirst({
        where: { action: "gate.test_result_submitted", entityId: requirement.id },
      });
      expect(qaAudit?.actorType).toBe("AGENT");
      expect(qaAudit?.actorId).toBe(qa.agent.id);
      expect(JSON.parse(qaAudit?.payloadJson ?? "{}")).toMatchObject({
        status: "PASSED",
        evidenceUrl: qaEvidenceUrl,
      });

      const ciAudit = await prisma.auditLog.findFirst({
        where: { action: "gate.ci_result_submitted", entityId: requirement.id },
      });
      expect(ciAudit?.actorType).toBe("MEMBER");
      expect(ciAudit?.actorId).toBe(space.commandBrainMemberId);
      expect(JSON.parse(ciAudit?.payloadJson ?? "{}")).toMatchObject({
        status: "PASSED",
        evidenceUrl: "https://ci.example/run/1",
      });

      const approvalAudit = await prisma.auditLog.findFirst({
        where: { action: "gate.command_approval_submitted", entityId: requirement.id },
      });
      expect(approvalAudit?.actorType).toBe("MEMBER");
      expect(approvalAudit?.actorId).toBe(space.commandBrainMemberId);
      expect(JSON.parse(approvalAudit?.payloadJson ?? "{}")).toMatchObject({
        status: "APPROVED",
      });

      const releaseAudit = await prisma.auditLog.findFirst({
        where: { action: "requirement.released", entityId: requirement.id },
      });
      expect(releaseAudit?.actorType).toBe("MEMBER");
      expect(releaseAudit?.actorId).toBe(space.commandBrainMemberId);
    } finally {
      await cleanup();
    }
  });

  it("prevents made-up QA tokens from submitting test results", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const { qa, requirement } = await seedReleaseRequirement(app, prisma);

      const response = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/test-result`,
        headers: { authorization: "Bearer made-up-qa-token" },
        payload: {
          memberId: qa.membership.id,
          status: "PASSED",
          evidenceUrl: "https://qa.example/run/fake-token",
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("prevents registered non-assigned QA agents from submitting another member's test result", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const { space, requirement } = await seedReleaseRequirement(app, prisma);
      const otherQa = await registerQa(app, space.id, "Other");

      const response = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/test-result`,
        headers: { authorization: "Bearer qa-agent-tokenOther" },
        payload: {
          memberId: otherQa.membership.id,
          status: "PASSED",
          evidenceUrl: "https://qa.example/run/other",
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("prevents assigned non-QA agents from submitting test results", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const space = await createSpace(app);
      const backend = await registerBackend(app, space.id);
      const requirement = await createReleaseRequirement(prisma, space, backend.membership.id);

      const response = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/test-result`,
        headers: { authorization: "Bearer backend-agent-token" },
        payload: {
          memberId: backend.membership.id,
          status: "PASSED",
          evidenceUrl: "https://qa.example/run/non-qa",
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("prevents non-brain tokens from submitting CI, command approval, or release", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const { qa, requirement } = await seedReleaseRequirement(app, prisma);

      const ci = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/ci-result`,
        headers: { authorization: "Bearer qa-agent-token" },
        payload: { status: "PASSED" },
      });
      const approval = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/command-approval`,
        headers: { authorization: "Bearer qa-agent-token" },
        payload: { status: "APPROVED" },
      });
      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/test-result`,
        headers: { authorization: "Bearer qa-agent-token" },
        payload: {
          memberId: qa.membership.id,
          status: "PASSED",
          evidenceUrl: "https://qa.example/run/non-brain",
        },
      });
      const release = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/release`,
        headers: { authorization: "Bearer qa-agent-token" },
      });

      expect(ci.statusCode).toBe(403);
      expect(approval.statusCode).toBe(403);
      expect(release.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("prevents viewer tokens from submitting command gate actions", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const { space, requirement } = await seedReleaseRequirement(app, prisma);

      const ci = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/ci-result`,
        headers: { authorization: `Bearer ${space.viewerToken}` },
        payload: { status: "PASSED" },
      });
      const approval = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/command-approval`,
        headers: { authorization: `Bearer ${space.viewerToken}` },
        payload: { status: "APPROVED" },
      });
      const release = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/release`,
        headers: { authorization: `Bearer ${space.viewerToken}` },
      });

      expect(ci.statusCode).toBe(403);
      expect(approval.statusCode).toBe(403);
      expect(release.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("blocks release when CI fails", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const { qa, requirement } = await seedReleaseRequirement(app, prisma);

      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/ci-result`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: { status: "FAILED", evidenceUrl: "https://ci.example/run/2" },
      });
      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/test-result`,
        headers: { authorization: "Bearer qa-agent-token" },
        payload: {
          memberId: qa.membership.id,
          status: "PASSED",
          evidenceUrl: "https://qa.example/run/ci-failed",
        },
      });
      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/command-approval`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: { status: "APPROVED" },
      });

      const response = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/release`,
        headers: { authorization: "Bearer brain-local-token" },
      });

      expect(response.statusCode).toBe(409);
    } finally {
      await cleanup();
    }
  });

  it("blocks release when command approval is rejected", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const { qa, requirement } = await seedReleaseRequirement(app, prisma);

      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/ci-result`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: { status: "PASSED", evidenceUrl: "https://ci.example/run/3" },
      });
      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/test-result`,
        headers: { authorization: "Bearer qa-agent-token" },
        payload: {
          memberId: qa.membership.id,
          status: "PASSED",
          evidenceUrl: "https://qa.example/run/rejected",
        },
      });
      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/command-approval`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: { status: "REJECTED" },
      });

      const response = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/release`,
        headers: { authorization: "Bearer brain-local-token" },
      });

      expect(response.statusCode).toBe(409);
    } finally {
      await cleanup();
    }
  });

  it("rejects QA test results without evidence", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const { qa, requirement } = await seedReleaseRequirement(app, prisma);

      const response = await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/test-result`,
        headers: { authorization: "Bearer qa-agent-token" },
        payload: { memberId: qa.membership.id, status: "PASSED" },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await cleanup();
    }
  });
});
