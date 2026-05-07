import { z } from "zod";
import { RequirementStatusSchema } from "./domain.js";

export const RealtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message.created"),
    spaceId: z.string(),
    conversationId: z.string(),
    messageId: z.string(),
  }),
  z.object({
    type: z.literal("requirement.updated"),
    spaceId: z.string(),
    requirementId: z.string(),
    status: RequirementStatusSchema,
  }),
  z.object({
    type: z.literal("gate.updated"),
    spaceId: z.string(),
    requirementId: z.string(),
    gateStatus: z.string(),
  }),
]);

export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;
