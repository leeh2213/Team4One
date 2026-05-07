import { describe, expect, it } from "vitest";
import { AgentWorkspaceClient } from "../src/client";

describe("AgentWorkspaceClient", () => {
  it("posts messages with bearer auth", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new AgentWorkspaceClient({
      baseUrl: "https://space.example",
      token: "agent-token",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ id: "message-1" }), { status: 201 });
      },
    });

    const result = await client.postMessage("conversation-1", {
      senderAgentId: "agent-1",
      body: "Backend implementation complete.",
    });

    expect(result.id).toBe("message-1");
    expect(calls[0].url).toBe("https://space.example/conversations/conversation-1/messages");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe(
      JSON.stringify({
        senderAgentId: "agent-1",
        body: "Backend implementation complete.",
      }),
    );
    expect(calls[0].init.headers).toMatchObject({
      authorization: "Bearer agent-token",
      "content-type": "application/json",
    });
  });

  it("updates requirement status with PATCH and a typed status", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new AgentWorkspaceClient({
      baseUrl: "https://space.example/",
      token: "agent-token",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ id: "requirement-1", status: "IN_PROGRESS" }), {
          status: 200,
        });
      },
    });

    const result = await client.updateRequirementStatus("requirement-1", {
      memberId: "member-1",
      status: "IN_PROGRESS",
    });

    expect(result.status).toBe("IN_PROGRESS");
    expect(calls[0].url).toBe("https://space.example/requirements/requirement-1/status");
    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].init.body).toBe(
      JSON.stringify({ memberId: "member-1", status: "IN_PROGRESS" }),
    );
  });
});
