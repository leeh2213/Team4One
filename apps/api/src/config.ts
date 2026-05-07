import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
  API_PORT: z.coerce.number().default(4100),
  DEV_BRAIN_TOKEN: z.string().default("brain-local-token"),
  DEV_AGENT_TOKEN: z.string().default("agent-local-token"),
  DEV_VIEWER_TOKEN: z.string().default("viewer-local-token"),
});

export const config = EnvSchema.parse(process.env);
