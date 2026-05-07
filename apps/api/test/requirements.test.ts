import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers";

async function registerAgent(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  spaceId: string,
  member: { displayName: string; email: string; role: string },
  agent: { harness: string; displayName: string; token: string },
) {
  const response = await app.inject({
    method: "POST",
    url: `/spaces/${spaceId}/agents`,
    headers: { authorization: "Bearer brain-local-token" },
    payload: { member, agent },
  });

  return response.json();
}

async function seedSpaceWithBackend(app: Awaited<ReturnType<typeof createTestApp>>["app"]) {
  const spaceResponse = await app.inject({
    method: "POST",
    url: "/spaces",
    headers: { authorization: "Bearer brain-local-token" },
    payload: {
      name: "Checkout",
      commandBrain: { displayName: "PM", email: "pm@example.com" },
    },
  });
  const space = spaceResponse.json();
  const backend = await registerAgent(
    app,
    space.id,
    { displayName: "Backend", email: "backend@example.com", role: "BACKEND" },
    { harness: "CODEX", displayName: "Backend Codex", token: "backend-token" },
  );
  return { space, backend };
}

async function createBackendRequirement(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  spaceId: string,
  assignedMemberId: string,
) {
  const response = await app.inject({
    method: "POST",
    url: `/spaces/${spaceId}/requirements`,
    headers: { authorization: "Bearer brain-local-token" },
    payload: {
      title: "Create payment webhook",
      description: "Receive provider webhook.",
      assignedMemberId,
      acceptanceCriteria: "Provider retry is idempotent.",
    },
  });

  return response.json();
}

describe("requirements", () => {
  it("lets the command brain create and assign requirements", async () => {
    const context = await createTestApp();
    const { app, cleanup } = context;

    try {
      const { space, backend } = await seedSpaceWithBackend(app);

      const response = await app.inject({
        method: "POST",
        url: `/spaces/${space.id}/requirements`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          title: "Create payment webhook",
          description: "Receive provider webhook and normalize payment status.",
          assignedMemberId: backend.membership.id,
          acceptanceCriteria: "Webhook persists event and returns 200 for duplicate delivery.",
          branchName: "feat/payment-webhook",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().status).toBe("ASSIGNED");
    } finally {
      await cleanup();
    }
  });

  it("prevents agents from updating requirements assigned to another member", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const { space, backend } = await seedSpaceWithBackend(app);
      const created = await app.inject({
        method: "POST",
        url: `/spaces/${space.id}/requirements`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          title: "Create payment webhook",
          description: "Receive provider webhook.",
          assignedMemberId: backend.membership.id,
          acceptanceCriteria: "Provider retry is idempotent.",
        },
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/requirements/${created.json().id}/status`,
        headers: { authorization: "Bearer wrong-agent-token" },
        payload: {
          memberId: "not-the-assignee",
          status: "IN_PROGRESS",
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("lets an assigned agent update its own requirement status", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const { space, backend } = await seedSpaceWithBackend(app);
      const created = await createBackendRequirement(app, space.id, backend.membership.id);

      const response = await app.inject({
        method: "PATCH",
        url: `/requirements/${created.id}/status`,
        headers: { authorization: "Bearer backend-token" },
        payload: {
          memberId: backend.membership.id,
          status: "IN_PROGRESS",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe("IN_PROGRESS");

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: "requirement.status_changed" },
      });
      expect(audit.actorType).toBe("AGENT");
      expect(audit.actorId).toBe(backend.agent.id);
    } finally {
      await cleanup();
    }
  });

  it("prevents registered agents from updating another member's requirement", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const { space, backend } = await seedSpaceWithBackend(app);
      const frontend = await registerAgent(
        app,
        space.id,
        { displayName: "Frontend", email: "frontend@example.com", role: "FRONTEND" },
        { harness: "QWEN_CODE", displayName: "Frontend Agent", token: "frontend-token" },
      );
      const created = await createBackendRequirement(app, space.id, backend.membership.id);

      const response = await app.inject({
        method: "PATCH",
        url: `/requirements/${created.id}/status`,
        headers: { authorization: "Bearer frontend-token" },
        payload: {
          memberId: frontend.membership.id,
          status: "IN_PROGRESS",
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("prevents fake tokens from updating the assigned member's requirement", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const { space, backend } = await seedSpaceWithBackend(app);
      const created = await createBackendRequirement(app, space.id, backend.membership.id);

      const response = await app.inject({
        method: "PATCH",
        url: `/requirements/${created.id}/status`,
        headers: { authorization: "Bearer fake-token" },
        payload: {
          memberId: backend.membership.id,
          status: "IN_PROGRESS",
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("rejects cross-space requirement assignments", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const { space } = await seedSpaceWithBackend(app);
      const other = await seedSpaceWithBackend(app);

      const response = await app.inject({
        method: "POST",
        url: `/spaces/${space.id}/requirements`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          title: "Cross-space work",
          description: "Should not assign across spaces.",
          assignedMemberId: other.backend.membership.id,
          acceptanceCriteria: "Assignment is rejected.",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe("assigned member must belong to space");
    } finally {
      await cleanup();
    }
  });

  it("rejects invalid status transitions and allows command brain updates", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const { space, backend } = await seedSpaceWithBackend(app);
      const created = await createBackendRequirement(app, space.id, backend.membership.id);

      const invalid = await app.inject({
        method: "PATCH",
        url: `/requirements/${created.id}/status`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          memberId: backend.membership.id,
          status: "RELEASED",
        },
      });
      expect(invalid.statusCode).toBe(409);

      const valid = await app.inject({
        method: "PATCH",
        url: `/requirements/${created.id}/status`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          memberId: backend.membership.id,
          status: "IN_PROGRESS",
        },
      });

      expect(valid.statusCode).toBe(200);
      expect(valid.json().status).toBe("IN_PROGRESS");
    } finally {
      await cleanup();
    }
  });
});
