import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createAudit } from "../src/audit";
import { buildApp } from "../src/app";
import { createPrismaClient } from "../src/db";

export async function createTestApp() {
  const databaseFile = `test-api-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
  const databaseUrl = `file:./${databaseFile}`;
  const databasePath = fileURLToPath(new URL(`../prisma/${databaseFile}`, import.meta.url));
  const apiRoot = fileURLToPath(new URL("..", import.meta.url));
  writeFileSync(databasePath, "");
  execFileSync("pnpm", ["exec", "prisma", "db", "push", "--skip-generate"], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  const prisma = createPrismaClient(databaseUrl);
  const app = await buildApp({ prisma });

  return {
    app,
    prisma,
    audit: createAudit(prisma),
    async cleanup() {
      await app.close();
      await prisma.$disconnect();
      rmSync(databasePath, { force: true });
    },
  };
}
