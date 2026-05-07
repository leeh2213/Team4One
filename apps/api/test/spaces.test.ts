import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers";

describe("project spaces", () => {
  it("creates one command brain and registers role agents", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "Payments Rewrite",
          commandBrain: {
            displayName: "Mina PM",
            email: "mina@example.com",
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const space = response.json();
      expect(space.commandBrainMemberId).toBeTruthy();
      expect(space.viewerToken).toMatch(/^viewer_/);
      expect(space.viewerTokenHash).toBeUndefined();

      const agentResponse = await app.inject({
        method: "POST",
        url: `/spaces/${space.id}/agents`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          member: {
            displayName: "Bo Backend",
            email: "bo@example.com",
            role: "BACKEND",
          },
          agent: {
            harness: "CODEX",
            displayName: "Bo Codex",
            token: "bo-agent-token",
          },
        },
      });

      expect(agentResponse.statusCode).toBe(201);
      expect(agentResponse.json().agent.tokenHash).toBeUndefined();
      expect(await prisma.agentIdentity.count()).toBe(1);
      expect(await prisma.auditLog.count()).toBe(2);

      const detailResponse = await app.inject({
        method: "GET",
        url: `/spaces/${space.id}`,
        headers: { authorization: "Bearer brain-local-token" },
      });

      expect(detailResponse.statusCode).toBe(200);
      expect(detailResponse.json().viewerTokenHash).toBeUndefined();
      expect(detailResponse.json().memberships[1].agent.tokenHash).toBeUndefined();

      const agentDetailResponse = await app.inject({
        method: "GET",
        url: `/spaces/${space.id}`,
        headers: { authorization: "Bearer bo-agent-token" },
      });

      expect(agentDetailResponse.statusCode).toBe(200);
    } finally {
      await cleanup();
    }
  });

  it("rejects creating a second command brain in the same space", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const created = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "Apollo",
          commandBrain: { displayName: "PM", email: "pm@example.com" },
        },
      });

      const space = created.json();
      const response = await app.inject({
        method: "POST",
        url: `/spaces/${space.id}/agents`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          member: {
            displayName: "Second PM",
            email: "pm2@example.com",
            role: "COMMAND_BRAIN",
          },
          agent: {
            harness: "CLAUDE_CODE",
            displayName: "PM Claude",
            token: "pm2-token",
          },
        },
      });

      expect(response.statusCode).toBe(409);
    } finally {
      await cleanup();
    }
  });

  it("requires auth for space detail", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const created = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "Private Space",
          commandBrain: { displayName: "PM", email: "pm@example.com" },
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/spaces/${created.json().id}`,
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await cleanup();
    }
  });

  it("allows viewer tokens to read space detail without command authority", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const created = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "Viewer Space",
          commandBrain: { displayName: "PM", email: "pm@example.com" },
        },
      });

      const space = created.json();
      const detail = await app.inject({
        method: "GET",
        url: `/spaces/${space.id}`,
        headers: { authorization: `Bearer ${space.viewerToken}` },
      });
      const commandMutation = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: `Bearer ${space.viewerToken}` },
        payload: {
          name: "Viewer Created",
          commandBrain: { displayName: "PM", email: "viewer@example.com" },
        },
      });

      expect(detail.statusCode).toBe(200);
      expect(commandMutation.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("scopes viewer tokens to their project space", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const first = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "Viewer Space A",
          commandBrain: { displayName: "PM A", email: "pma@example.com" },
        },
      });
      const second = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "Viewer Space B",
          commandBrain: { displayName: "PM B", email: "pmb@example.com" },
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/spaces/${second.json().id}`,
        headers: { authorization: `Bearer ${first.json().viewerToken}` },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("rejects made-up tokens for space detail", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const created = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "Private Space",
          commandBrain: { displayName: "PM", email: "pm@example.com" },
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/spaces/${created.json().id}`,
        headers: { authorization: "Bearer made-up-token" },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("normalizes invalid bodies and duplicate memberships", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const invalid = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "",
          commandBrain: { displayName: "", email: "not-an-email" },
        },
      });

      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().message).toBe("Invalid request");

      const created = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: {
          name: "Apollo",
          commandBrain: { displayName: "PM", email: "pm@example.com" },
        },
      });
      const space = created.json();
      const payload = {
        member: {
          displayName: "Bo Backend",
          email: "bo@example.com",
          role: "BACKEND",
        },
        agent: {
          harness: "CODEX",
          displayName: "Bo Codex",
          token: "bo-agent-token",
        },
      };

      expect(
        (
          await app.inject({
            method: "POST",
            url: `/spaces/${space.id}/agents`,
            headers: { authorization: "Bearer brain-local-token" },
            payload,
          })
        ).statusCode,
      ).toBe(201);

      const duplicate = await app.inject({
        method: "POST",
        url: `/spaces/${space.id}/agents`,
        headers: { authorization: "Bearer brain-local-token" },
        payload,
      });

      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.json().message).toBe("Resource already exists");
    } finally {
      await cleanup();
    }
  });

  it("allows the same command brain email to create another space", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const payload = {
        commandBrain: { displayName: "PM", email: "pm@example.com" },
      };

      const first = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: { ...payload, name: "First" },
      });
      const second = await app.inject({
        method: "POST",
        url: "/spaces",
        headers: { authorization: "Bearer brain-local-token" },
        payload: { ...payload, name: "Second" },
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
    } finally {
      await cleanup();
    }
  });

  it("includes project work, gates, and conversation messages in space detail", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const pm = await prisma.user.create({
        data: { displayName: "Mina PM", email: "mina@example.com" },
      });
      const backendUser = await prisma.user.create({
        data: { displayName: "Bo Backend", email: "bo@example.com" },
      });
      const space = await prisma.projectSpace.create({
        data: { name: "Payments Rewrite" },
      });
      const commandBrain = await prisma.membership.create({
        data: { spaceId: space.id, userId: pm.id, role: "COMMAND_BRAIN" },
      });
      await prisma.projectSpace.update({
        where: { id: space.id },
        data: { commandBrainMemberId: commandBrain.id },
      });
      const backend = await prisma.membership.create({
        data: { spaceId: space.id, userId: backendUser.id, role: "BACKEND" },
      });
      const conversation = await prisma.conversation.create({
        data: { spaceId: space.id, topic: "Project Room", scopeType: "GLOBAL" },
      });
      const requirement = await prisma.requirement.create({
        data: {
          spaceId: space.id,
          title: "Create payment webhook",
          description: "Receive provider webhooks and normalize payment status updates.",
          status: "IN_PROGRESS",
          createdByMemberId: commandBrain.id,
          assignedMemberId: backend.id,
          acceptanceCriteria: "Webhook persists each event and handles duplicate delivery safely.",
          gate: { create: { ciStatus: "PENDING", testStatus: "PENDING" } },
        },
      });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          requirementId: requirement.id,
          senderMemberId: commandBrain.id,
          body: "Backend owns webhook. QA will validate idempotency.",
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/spaces/${space.id}`,
        headers: { authorization: "Bearer brain-local-token" },
      });

      expect(response.statusCode).toBe(200);
      const detail = response.json();
      expect(detail.requirements[0]).toMatchObject({
        title: "Create payment webhook",
        assignedMember: {
          user: { displayName: "Bo Backend" },
        },
        gate: {
          ciStatus: "PENDING",
          testStatus: "PENDING",
          commandApprovalStatus: "PENDING",
          releaseStatus: "BLOCKED",
        },
      });
      expect(detail.conversations[0].messages[0]).toMatchObject({
        body: "Backend owns webhook. QA will validate idempotency.",
        senderMember: {
          user: { displayName: "Mina PM" },
        },
      });
    } finally {
      await cleanup();
    }
  });
});
