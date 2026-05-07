import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers";

async function createSpace(app: Awaited<ReturnType<typeof createTestApp>>["app"], name = "Search") {
  const response = await app.inject({
    method: "POST",
    url: "/spaces",
    headers: { authorization: "Bearer brain-local-token" },
    payload: {
      name,
      commandBrain: { displayName: "PM", email: `${name.toLowerCase()}@example.com` },
    },
  });

  return response.json();
}

async function registerAgent(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  spaceId: string,
  token = "backend-token",
) {
  const response = await app.inject({
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
        displayName: "Backend Codex",
        token,
      },
    },
  });

  return response.json();
}

describe("messages", () => {
  it("stores chat-style messages and audit entries", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const space = await createSpace(app);
      const conversation = await prisma.conversation.findFirstOrThrow({
        where: { spaceId: space.id, scopeType: "GLOBAL" },
      });

      const response = await app.inject({
        method: "POST",
        url: `/conversations/${conversation.id}/messages`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          senderMemberId: space.commandBrainMemberId,
          body: "Please start backend schema design.",
          metadata: { importance: "high" },
        },
      });

      expect(response.statusCode).toBe(201);
      expect(await prisma.message.count()).toBe(1);
      expect(await prisma.auditLog.count()).toBe(2);

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: "message.created" },
      });
      expect(audit.actorType).toBe("MEMBER");
      expect(audit.actorId).toBe(space.commandBrainMemberId);
    } finally {
      await cleanup();
    }
  });

  it("returns a chronological project timeline", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const created = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "Timeline",
          commandBrain: { displayName: "PM", email: "pm@example.com" },
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/spaces/${created.json().id}/timeline`,
        headers: { authorization: "Bearer brain-local-token" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()[0].action).toBe("space.created");
    } finally {
      await cleanup();
    }
  });

  it("rejects made-up tokens posting as an agent", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const space = await createSpace(app, "Private");
      const backend = await registerAgent(app, space.id);
      const conversation = await prisma.conversation.findFirstOrThrow({
        where: { spaceId: space.id, scopeType: "GLOBAL" },
      });

      const response = await app.inject({
        method: "POST",
        url: `/conversations/${conversation.id}/messages`,
        headers: { authorization: "Bearer made-up-token" },
        payload: {
          senderAgentId: backend.agent.id,
          body: "This should not be accepted.",
        },
      });

      expect(response.statusCode).toBe(403);
      expect(await prisma.message.count()).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it("rejects made-up tokens reading a timeline", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const space = await createSpace(app, "Locked");

      const response = await app.inject({
        method: "GET",
        url: `/spaces/${space.id}/timeline`,
        headers: { authorization: "Bearer made-up-token" },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("attributes real agent messages to the agent identity", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const space = await createSpace(app, "AgentChat");
      const backend = await registerAgent(app, space.id);
      const conversation = await prisma.conversation.findFirstOrThrow({
        where: { spaceId: space.id, scopeType: "GLOBAL" },
      });

      const response = await app.inject({
        method: "POST",
        url: `/conversations/${conversation.id}/messages`,
        headers: { authorization: "Bearer backend-token" },
        payload: {
          senderAgentId: backend.agent.id,
          body: "Backend schema design is underway.",
        },
      });

      expect(response.statusCode).toBe(201);

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: "message.created" },
      });
      expect(audit.actorType).toBe("AGENT");
      expect(audit.actorId).toBe(backend.agent.id);
    } finally {
      await cleanup();
    }
  });
});
