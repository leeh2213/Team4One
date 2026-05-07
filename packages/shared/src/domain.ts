import { z } from "zod";

export const MemberRoleSchema = z.enum([
  "COMMAND_BRAIN",
  "BACKEND",
  "FRONTEND",
  "ALGORITHM",
  "QA",
]);

export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const AgentHarnessSchema = z.enum([
  "CLAUDE_CODE",
  "CODEX",
  "QWEN_CODE",
  "OPENCODE",
  "OTHER",
]);

export type AgentHarness = z.infer<typeof AgentHarnessSchema>;

export const RequirementStatusSchema = z.enum([
  "DRAFT",
  "ASSIGNED",
  "IN_PROGRESS",
  "READY_FOR_TEST",
  "TEST_PASSED",
  "CI_PASSED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "RELEASED",
  "BLOCKED",
  "REJECTED",
]);

export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;

const allowedTransitions: Record<RequirementStatus, RequirementStatus[]> = {
  DRAFT: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["READY_FOR_TEST", "BLOCKED"],
  READY_FOR_TEST: ["TEST_PASSED", "REJECTED"],
  TEST_PASSED: ["CI_PASSED", "BLOCKED"],
  CI_PASSED: ["AWAITING_APPROVAL"],
  AWAITING_APPROVAL: ["APPROVED", "REJECTED"],
  APPROVED: ["RELEASED"],
  RELEASED: [],
  BLOCKED: ["IN_PROGRESS", "REJECTED"],
  REJECTED: ["DRAFT"],
};

export function canTransitionRequirement(
  from: RequirementStatus,
  to: RequirementStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export const ProjectSpaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  commandBrainMemberId: z.string(),
});

export const RequirementSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  status: RequirementStatusSchema,
  createdByMemberId: z.string(),
  assignedMemberId: z.string().nullable(),
});
