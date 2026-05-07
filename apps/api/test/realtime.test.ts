import type { RealtimeEvent } from "@team4one/shared";
import { RealtimeEventSchema } from "@team4one/shared";
import { io as createSocketClient, type Socket as ClientSocket } from "socket.io-client";
import { describe, expect, it } from "vitest";
import { createRealtimeServer } from "../src/realtime";
import { createTestApp } from "./helpers";

type TestApp = Awaited<ReturnType<typeof createTestApp>>["app"];
type TestPrisma = Awaited<ReturnType<typeof createTestApp>>["prisma"];
type JoinResult = { ok: boolean; message?: string };

function captureRealtimeEvents(app: TestApp) {
  const events: RealtimeEvent[] = [];
  app.decorate("realtime", {
    publish(event: RealtimeEvent) {
      events.push(event);
    },
  });
  return events;
}

function getServerUrl(app: TestApp) {
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server is not listening on a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
}

function connectSocket(url: string, token: string) {
  const socket = createSocketClient(url, {
    auth: { token },
    forceNew: true,
  });

  return new Promise<ClientSocket>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("socket connection timed out"));
    }, 1_000);

    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function joinSpace(socket: ClientSocket, spaceId: string) {
  return new Promise<JoinResult>((resolve) => {
    socket.timeout(1_000).emit("space:join", spaceId, (error: Error | null, result: JoinResult) => {
      if (error) {
        resolve({ ok: false, message: "timeout" });
        return;
      }
      resolve(result);
    });
  });
}

function waitForSocketEvent(socket: ClientSocket, eventType: RealtimeEvent["type"]) {
  return new Promise<RealtimeEvent>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const onEvent = (event: RealtimeEvent) => {
      clearTimeout(timer);
      resolve(event);
    };
    timer = setTimeout(() => {
      socket.off(eventType, onEvent);
      reject(new Error(`timed out waiting for ${eventType}`));
    }, 1_000);
    socket.once(eventType, onEvent);
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createSpace(app: TestApp, name = "Realtime") {
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
  app: TestApp,
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

async function createRequirement(app: TestApp, spaceId: string, assignedMemberId: string) {
  const response = await app.inject({
    method: "POST",
    url: `/spaces/${spaceId}/requirements`,
    headers: { authorization: "Bearer brain-local-token" },
    payload: {
      title: "Wire realtime events",
      description: "Publish project changes to connected clients.",
      assignedMemberId,
      acceptanceCriteria: "Clients receive updates after successful writes.",
    },
  });

  return response.json();
}

async function createReleaseRequirement(
  prisma: TestPrisma,
  space: { id: string; commandBrainMemberId: string },
  assignedMemberId: string,
) {
  return prisma.requirement.create({
    data: {
      spaceId: space.id,
      title: "Releaseable realtime work",
      description: "A requirement ready for deployment gates.",
      status: "CI_PASSED",
      createdByMemberId: space.commandBrainMemberId,
      assignedMemberId,
      acceptanceCriteria: "CI, QA, and command approval pass.",
      gate: { create: {} },
    },
  });
}

describe("realtime event contract", () => {
  it("validates message, requirement, and gate event payloads", () => {
    expect(
      RealtimeEventSchema.parse({
        type: "message.created",
        spaceId: "space-1",
        conversationId: "conversation-1",
        messageId: "message-1",
      }),
    ).toBeTruthy();

    expect(
      RealtimeEventSchema.parse({
        type: "requirement.updated",
        spaceId: "space-1",
        requirementId: "requirement-1",
        status: "IN_PROGRESS",
      }),
    ).toBeTruthy();

    expect(
      RealtimeEventSchema.parse({
        type: "gate.updated",
        spaceId: "space-1",
        requirementId: "requirement-1",
        gateStatus: "PASSED",
      }),
    ).toBeTruthy();
  });
});

describe("realtime route publishing", () => {
  it("publishes message.created after posting a conversation message", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const events = captureRealtimeEvents(app);
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
          body: "Realtime publish check.",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(events).toContainEqual({
        type: "message.created",
        spaceId: space.id,
        conversationId: conversation.id,
        messageId: response.json().id,
      });
    } finally {
      await cleanup();
    }
  });

  it("publishes requirement.updated after updating requirement status", async () => {
    const { app, cleanup } = await createTestApp();

    try {
      const events = captureRealtimeEvents(app);
      const space = await createSpace(app, "RequirementRealtime");
      const backend = await registerAgent(
        app,
        space.id,
        { displayName: "Backend", email: "backend@example.com", role: "BACKEND" },
        { harness: "CODEX", displayName: "Backend Agent", token: "backend-token" },
      );
      const requirement = await createRequirement(app, space.id, backend.membership.id);

      const response = await app.inject({
        method: "PATCH",
        url: `/requirements/${requirement.id}/status`,
        headers: { authorization: "Bearer backend-token" },
        payload: {
          memberId: backend.membership.id,
          status: "IN_PROGRESS",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(events).toContainEqual({
        type: "requirement.updated",
        spaceId: space.id,
        requirementId: requirement.id,
        status: "IN_PROGRESS",
      });
    } finally {
      await cleanup();
    }
  });

  it("publishes gate.updated after updating a gate", async () => {
    const { app, prisma, cleanup } = await createTestApp();

    try {
      const events = captureRealtimeEvents(app);
      const space = await createSpace(app, "GateRealtime");
      const qa = await registerAgent(
        app,
        space.id,
        { displayName: "QA", email: "qa@example.com", role: "QA" },
        { harness: "OPENCODE", displayName: "QA Agent", token: "qa-agent-token" },
      );
      const requirement = await createReleaseRequirement(prisma, space, qa.membership.id);

      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/ci-result`,
        headers: { authorization: "Bearer brain-local-token" },
        payload: { status: "PASSED", evidenceUrl: "https://ci.example/run/realtime" },
      });
      await app.inject({
        method: "POST",
        url: `/requirements/${requirement.id}/test-result`,
        headers: { authorization: "Bearer qa-agent-token" },
        payload: {
          memberId: qa.membership.id,
          status: "PASSED",
          evidenceUrl: "https://qa.example/run/realtime",
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

      expect(response.statusCode).toBe(200);
      expect(events).toContainEqual({
        type: "gate.updated",
        spaceId: space.id,
        requirementId: requirement.id,
        gateStatus: "RELEASED",
      });
    } finally {
      await cleanup();
    }
  });
});

describe("Socket.IO realtime server", () => {
  it("authorizes room joins and scopes published events to joined spaces", async () => {
    const { app, cleanup } = await createTestApp();
    let socket: ClientSocket | undefined;

    try {
      const realtime = createRealtimeServer(app);
      app.decorate("realtime", realtime);
      const ownedSpace = await createSpace(app, "SocketOwned");
      const otherSpace = await createSpace(app, "SocketOther");
      await registerAgent(
        app,
        ownedSpace.id,
        { displayName: "Socket QA", email: "socket-qa@example.com", role: "QA" },
        { harness: "OPENCODE", displayName: "Socket QA Agent", token: "socket-agent-token" },
      );
      await app.listen({ port: 0, host: "127.0.0.1" });

      socket = await connectSocket(getServerUrl(app), "socket-agent-token");

      await expect(joinSpace(socket, ownedSpace.id)).resolves.toMatchObject({ ok: true });
      await expect(joinSpace(socket, otherSpace.id)).resolves.toMatchObject({ ok: false });

      const ownEvent: RealtimeEvent = {
        type: "message.created",
        spaceId: ownedSpace.id,
        conversationId: "conversation-1",
        messageId: "message-1",
      };
      const received = waitForSocketEvent(socket, "message.created");
      realtime.publish(ownEvent);
      await expect(received).resolves.toEqual(ownEvent);

      const leakedEvents: RealtimeEvent[] = [];
      socket.on("message.created", (event: RealtimeEvent) => leakedEvents.push(event));
      realtime.publish({
        type: "message.created",
        spaceId: otherSpace.id,
        conversationId: "conversation-2",
        messageId: "message-2",
      });
      await delay(50);
      expect(leakedEvents).toEqual([]);
    } finally {
      socket?.disconnect();
      await cleanup();
    }
  });

  it("allows viewer tokens to join read-only space rooms", async () => {
    const { app, cleanup } = await createTestApp();
    let socket: ClientSocket | undefined;

    try {
      const realtime = createRealtimeServer(app);
      app.decorate("realtime", realtime);
      const space = await createSpace(app, "SocketViewer");
      const otherSpace = await createSpace(app, "SocketViewerOther");
      await app.listen({ port: 0, host: "127.0.0.1" });

      socket = await connectSocket(getServerUrl(app), space.viewerToken);

      await expect(joinSpace(socket, space.id)).resolves.toMatchObject({ ok: true });
      await expect(joinSpace(socket, otherSpace.id)).resolves.toMatchObject({ ok: false });
    } finally {
      socket?.disconnect();
      await cleanup();
    }
  });
});
