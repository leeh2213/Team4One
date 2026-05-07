import { buildApp } from "./app";
import { config } from "./config";
import { createPrismaClient } from "./db";
import { createRealtimeServer } from "./realtime";

const prisma = createPrismaClient();
const app = await buildApp({ prisma });
app.decorate("realtime", createRealtimeServer(app));

await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
