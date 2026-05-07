import { describe, expect, it } from "vitest";
import {
  AgentHarnessSchema,
  MemberRoleSchema,
  ProjectSpaceSchema,
  RequirementSchema,
  RequirementStatusSchema,
  canTransitionRequirement,
} from "../src/domain";
import { RealtimeEventSchema } from "../src/events";
import * as SharedContracts from "../src/index";

describe("shared domain contracts", () => {
  it("accepts the required project roles and agent harnesses", () => {
    expect(MemberRoleSchema.parse("COMMAND_BRAIN")).toBe("COMMAND_BRAIN");
    expect(MemberRoleSchema.parse("BACKEND")).toBe("BACKEND");
    expect(MemberRoleSchema.parse("FRONTEND")).toBe("FRONTEND");
    expect(MemberRoleSchema.parse("ALGORITHM")).toBe("ALGORITHM");
    expect(MemberRoleSchema.parse("QA")).toBe("QA");
    expect(AgentHarnessSchema.parse("CODEX")).toBe("CODEX");
    expect(AgentHarnessSchema.parse("CLAUDE_CODE")).toBe("CLAUDE_CODE");
    expect(AgentHarnessSchema.parse("QWEN_CODE")).toBe("QWEN_CODE");
    expect(AgentHarnessSchema.parse("OPENCODE")).toBe("OPENCODE");
  });

  it("allows only valid requirement status transitions", () => {
    expect(RequirementStatusSchema.parse("ASSIGNED")).toBe("ASSIGNED");
    expect(canTransitionRequirement("ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionRequirement("CI_PASSED", "RELEASED")).toBe(false);
  });

  it("validates project spaces", () => {
    expect(
      ProjectSpaceSchema.parse({
        id: "space-1",
        name: "Launch Room",
        commandBrainMemberId: "member-1",
      }),
    ).toEqual({
      id: "space-1",
      name: "Launch Room",
      commandBrainMemberId: "member-1",
    });

    expect(() =>
      ProjectSpaceSchema.parse({
        id: "space-1",
        name: "",
        commandBrainMemberId: "member-1",
      }),
    ).toThrow();
  });

  it("validates requirements with nullable assignments", () => {
    expect(
      RequirementSchema.parse({
        id: "req-1",
        spaceId: "space-1",
        title: "Build shared contracts",
        description: "Define MVP domain types",
        status: "DRAFT",
        createdByMemberId: "member-1",
        assignedMemberId: null,
      }),
    ).toMatchObject({
      id: "req-1",
      status: "DRAFT",
      assignedMemberId: null,
    });

    expect(() =>
      RequirementSchema.parse({
        id: "req-1",
        spaceId: "space-1",
        title: "",
        description: "Define MVP domain types",
        status: "DRAFT",
        createdByMemberId: "member-1",
        assignedMemberId: null,
      }),
    ).toThrow();
  });

  it("validates realtime requirement events", () => {
    expect(
      RealtimeEventSchema.parse({
        type: "requirement.updated",
        spaceId: "space-1",
        requirementId: "req-1",
        status: "READY_FOR_TEST",
      }),
    ).toEqual({
      type: "requirement.updated",
      spaceId: "space-1",
      requirementId: "req-1",
      status: "READY_FOR_TEST",
    });

    expect(() =>
      RealtimeEventSchema.parse({
        type: "requirement.updated",
        spaceId: "space-1",
        requirementId: "req-1",
        status: "NOT_A_STATUS",
      }),
    ).toThrow();
  });

  it("exports shared contracts through the package barrel", () => {
    expect(SharedContracts.MemberRoleSchema.parse("QA")).toBe("QA");
    expect(SharedContracts.RealtimeEventSchema.parse({
      type: "message.created",
      spaceId: "space-1",
      conversationId: "conversation-1",
      messageId: "message-1",
    })).toEqual({
      type: "message.created",
      spaceId: "space-1",
      conversationId: "conversation-1",
      messageId: "message-1",
    });
  });
});
