import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashToken } from "./auth";
import { config } from "./config";
import { createPrismaClient } from "./db";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const prismaRoot = fileURLToPath(new URL("../prisma/", import.meta.url));
const prisma = createPrismaClient(config.DATABASE_URL);
const seededSpaceId = "seed-space-vessel-tracking";

function ensureSqliteDatabaseFile(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) return;

  const sqlitePath = databaseUrl.slice("file:".length).split("?")[0];
  if (!sqlitePath || sqlitePath === ":memory:") return;

  const databasePath = isAbsolute(sqlitePath)
    ? sqlitePath
    : resolve(prismaRoot, sqlitePath);

  if (!existsSync(databasePath)) {
    mkdirSync(dirname(databasePath), { recursive: true });
    writeFileSync(databasePath, "");
  }
}

function ensureDatabaseSchema() {
  ensureSqliteDatabaseFile(config.DATABASE_URL);
  execFileSync("pnpm", ["exec", "prisma", "db", "push", "--skip-generate"], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: config.DATABASE_URL },
    stdio: "inherit",
  });
}

async function clearMvpData() {
  await prisma.projectSpace.updateMany({
    data: { commandBrainMemberId: null },
  });

  await prisma.auditLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.deploymentGate.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.agentIdentity.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.projectSpace.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  ensureDatabaseSchema();
  await clearMvpData();

  const hm = await prisma.user.create({
    data: {
      displayName: "HM Command",
      email: "hm.command@example.com",
    },
  });

  const space = await prisma.projectSpace.create({
    data: {
      id: seededSpaceId,
      name: "HM Vessel Tracking Command Center",
      viewerTokenHash: hashToken(config.DEV_VIEWER_TOKEN),
    },
  });

  const commandBrain = await prisma.membership.create({
    data: {
      spaceId: space.id,
      userId: hm.id,
      role: "COMMAND_BRAIN",
    },
  });

  await prisma.projectSpace.update({
    where: { id: space.id },
    data: { commandBrainMemberId: commandBrain.id },
  });

  const memberSeeds = [
    {
      key: "frontend",
      displayName: "Fiona Frontend",
      email: "frontend.agent@example.com",
      role: "FRONTEND",
      harness: "CLAUDE_CODE",
      agentDisplayName: "Frontend Control Tower Agent",
      token: "frontend-agent-token",
    },
    {
      key: "data",
      displayName: "Dylan Data",
      email: "data.agent@example.com",
      role: "BACKEND",
      harness: "CODEX",
      agentDisplayName: "Backend Data Agent",
      token: "data-agent-token",
    },
    {
      key: "algorithm",
      displayName: "Ari Algorithm",
      email: "algorithm.agent@example.com",
      role: "ALGORITHM",
      harness: "QWEN_CODE",
      agentDisplayName: "ETA Risk Algorithm Agent",
      token: "algorithm-agent-token",
    },
    {
      key: "qa",
      displayName: "Quinn QA",
      email: "qa.agent@example.com",
      role: "QA",
      harness: "OPENCODE",
      agentDisplayName: "QA Acceptance Agent",
      token: "qa-agent-token",
    },
  ] as const;

  const seededMembers: Record<
    (typeof memberSeeds)[number]["key"],
    { membershipId: string; agentId: string }
  > = Object.create(null);

  for (const memberSeed of memberSeeds) {
    const user = await prisma.user.create({
      data: {
        displayName: memberSeed.displayName,
        email: memberSeed.email,
      },
    });

    const membership = await prisma.membership.create({
      data: {
        spaceId: space.id,
        userId: user.id,
        role: memberSeed.role,
      },
    });

    const agent = await prisma.agentIdentity.create({
      data: {
        membershipId: membership.id,
        harness: memberSeed.harness,
        displayName: memberSeed.agentDisplayName,
        tokenHash: hashToken(memberSeed.token),
      },
    });

    seededMembers[memberSeed.key] = {
      membershipId: membership.id,
      agentId: agent.id,
    };
  }

  const conversation = await prisma.conversation.create({
    data: {
      spaceId: space.id,
      topic: "HM Vessel Tracking Delivery Room",
      scopeType: "GLOBAL",
    },
  });

  const requirements = await Promise.all([
    prisma.requirement.create({
      data: {
        spaceId: space.id,
        title: "Build vessel tracking dashboard",
        description:
          "Build the first-screen vessel tracking control tower with route status, active vessel cards, and HM command handoff visibility.",
        status: "AWAITING_APPROVAL",
        createdByMemberId: commandBrain.id,
        assignedMemberId: seededMembers.frontend.membershipId,
        acceptanceCriteria:
          "Dashboard shows vessel timeline, exception badges, agent ownership, and release evidence without hiding gate status.",
        branchName: "feat/vessel-control-tower-ui",
        gate: {
          create: {
            ciStatus: "PASSED",
            testStatus: "PASSED",
            commandApprovalStatus: "PENDING",
            releaseStatus: "BLOCKED",
            evidenceUrl: "https://example.com/evidence/vessel-control-tower-ui",
          },
        },
      },
    }),
    prisma.requirement.create({
      data: {
        spaceId: space.id,
        title: "Seed shipment event data",
        description:
          "Model vessel, port call, milestone, exception, and AIS-derived event data for end-to-end transport tracking.",
        status: "IN_PROGRESS",
        createdByMemberId: commandBrain.id,
        assignedMemberId: seededMembers.data.membershipId,
        acceptanceCriteria:
          "API data can represent booking, departure, transshipment, arrival, customs, delivery, and exception events with stable ids.",
        branchName: "feat/shipping-event-data-model",
        gate: {
          create: {
            ciStatus: "PASSED",
            testStatus: "PENDING",
            commandApprovalStatus: "PENDING",
            releaseStatus: "BLOCKED",
            evidenceUrl: "https://example.com/evidence/shipping-event-schema",
          },
        },
      },
    }),
    prisma.requirement.create({
      data: {
        spaceId: space.id,
        title: "Calculate ETA and risk score",
        description:
          "Calculate ETA drift and risk alerts from route milestones, dwell time, weather placeholders, and customs delay signals.",
        status: "READY_FOR_TEST",
        createdByMemberId: commandBrain.id,
        assignedMemberId: seededMembers.algorithm.membershipId,
        acceptanceCriteria:
          "Algorithm flags late vessels, port dwell risk, missing milestones, and high-risk handoffs with explainable reasons.",
        branchName: "feat/eta-risk-alerts",
        gate: {
          create: {
            ciStatus: "PENDING",
            testStatus: "PENDING",
            commandApprovalStatus: "PENDING",
            releaseStatus: "BLOCKED",
          },
        },
      },
    }),
    prisma.requirement.create({
      data: {
        spaceId: space.id,
        title: "Verify full-flow shipping journey",
        description:
          "Validate HM can assign work, inspect agent progress, review gate evidence, and follow a shipment from booking to delivery.",
        status: "ASSIGNED",
        createdByMemberId: commandBrain.id,
        assignedMemberId: seededMembers.qa.membershipId,
        acceptanceCriteria:
          "E2E run covers roster, requirements, conversation stream, release gate panel, and representative vessel tracking workflow.",
        branchName: "test/e2e-vessel-tracking-acceptance",
        gate: {
          create: {
            ciStatus: "PENDING",
            testStatus: "PENDING",
            commandApprovalStatus: "PENDING",
            releaseStatus: "BLOCKED",
          },
        },
      },
    }),
  ]);

  const [controlTowerUi, eventDataModel, etaRiskLogic, e2eAcceptance] = requirements;

  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        senderMemberId: commandBrain.id,
        body:
          "HM assigned: Team4One is now the collaboration hub for a ship transportation full-flow tracking platform. Frontend owns the dashboard, Backend/Data owns shipment data, Algorithm owns ETA and risk score, and QA owns the E2E gate.",
      },
      {
        conversationId: conversation.id,
        requirementId: controlTowerUi.id,
        senderAgentId: seededMembers.frontend.agentId,
        body:
          "Frontend Control Tower Agent: dashboard shell, vessel cards, exception badges, and release gate evidence are ready for HM pre-approval review.",
      },
      {
        conversationId: conversation.id,
        requirementId: eventDataModel.id,
        senderAgentId: seededMembers.data.agentId,
        body:
          "Backend Data Agent: shipment data now covers booking, departure, transshipment, arrival, customs, delivery, and exception events in the API seed payload.",
      },
      {
        conversationId: conversation.id,
        requirementId: etaRiskLogic.id,
        senderAgentId: seededMembers.algorithm.agentId,
        body:
          "ETA Risk Algorithm Agent: ETA drift and risk score rules for port dwell, missing milestones, and route exceptions are ready for QA scenario testing.",
      },
      {
        conversationId: conversation.id,
        requirementId: e2eAcceptance.id,
        senderAgentId: seededMembers.qa.agentId,
        body:
          "QA Acceptance Agent: E2E gate plan covers HM assignment, agent reports, requirements, gate evidence, and the shipment path from booking to final delivery.",
      },
      {
        conversationId: conversation.id,
        requirementId: controlTowerUi.id,
        senderMemberId: commandBrain.id,
        body:
          "HM Command: 控制塔 UI 的 CI 和测试证据已通过，release gate 保持 BLOCKED，等我最终 approval 后才能发布。",
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
