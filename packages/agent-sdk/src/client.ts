import type { RequirementStatus } from "@team4one/shared";

type FetchImpl = typeof fetch;

export type AgentWorkspaceClientOptions = {
  baseUrl: string;
  token: string;
  fetchImpl?: FetchImpl;
};

export class AgentWorkspaceClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: FetchImpl;

  constructor(options: AgentWorkspaceClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async postMessage(
    conversationId: string,
    payload: {
      senderMemberId?: string;
      senderAgentId?: string;
      requirementId?: string;
      body: string;
      metadata?: unknown;
    },
  ) {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateRequirementStatus(
    requirementId: string,
    payload: { memberId: string; status: RequirementStatus },
  ) {
    return this.request(`/requirements/${requirementId}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  private async request(path: string, init: RequestInit) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`request failed: ${response.status}`);
    }
    return response.json();
  }
}
