# Team Agent Collaboration Space

Team4One is an MVP collaboration workspace where one command brain coordinates project members and their independent coding agents. A project space captures assignments, agent identities, conversation, audit history, and release gates so implementation work has a single decision owner and visible evidence.

## Local Development

```bash
pnpm install
cp .env.example .env
pnpm --filter @team4one/api prisma:generate
pnpm --filter @team4one/api prisma:migrate
pnpm --filter @team4one/api seed
pnpm dev
```

The API runs at `http://localhost:4100`.

The web app runs at `http://localhost:5173`.

The seeded vessel tracking space is `seed-space-vessel-tracking`. It includes one HM command brain plus frontend, backend/data, algorithm, and QA agents. Their local development tokens are `frontend-agent-token`, `data-agent-token`, `algorithm-agent-token`, and `qa-agent-token`.

The browser workspace uses the read-only development token from `.env.example`: `viewer-local-token`.

## Verification

```bash
pnpm --filter @team4one/api prisma:generate
pnpm --filter @team4one/api seed
pnpm test
pnpm typecheck
pnpm build
```

Run end-to-end coverage when Playwright tests are available:

```bash
pnpm e2e
```
