# Repository Guidelines

## Project Structure & Module Organization

Team4One is a pnpm TypeScript monorepo. `apps/web` contains the React/Vite UI, with source in `apps/web/src`, reusable panels in `apps/web/src/components`, API clients in `apps/web/src/api`, and component tests in `apps/web/src/test`. `apps/api` contains the Fastify API, Prisma schema in `apps/api/prisma/schema.prisma`, route modules in `apps/api/src/routes`, and API tests in `apps/api/test`. Shared domain schemas and transition rules live in `packages/shared/src`; the agent client package lives in `packages/agent-sdk/src`. End-to-end flows are in `tests/e2e`.

## Build, Test, and Development Commands

Use pnpm 9.15.0, as declared in `package.json`.

- `pnpm install`: install workspace dependencies.
- `cp .env.example .env`: create local API/web defaults.
- `pnpm --filter @team4one/api prisma:generate`: generate the Prisma client.
- `pnpm --filter @team4one/api prisma:migrate`: apply local SQLite migrations.
- `pnpm --filter @team4one/api seed`: seed the demo project space.
- `pnpm dev`: run API on `:4100` and web on `:5173`.
- `pnpm test`, `pnpm typecheck`, `pnpm build`: run all package tests, strict TypeScript checks, and builds.
- `pnpm e2e`: seed data and run Playwright desktop and mobile Chromium tests.

## Coding Style & Naming Conventions

Write strict TypeScript using ES modules. Follow the existing style: two-space indentation, double quotes, trailing commas in multiline calls, PascalCase React components, camelCase functions and variables, and uppercase string enums/status literals. Keep shared Zod schemas and exported types in `packages/shared` so API, web, and SDK contracts stay aligned. Prefer small route/component modules over broad cross-cutting files.

## Testing Guidelines

Unit and integration tests use Vitest. Name tests `*.test.ts` or `*.test.tsx` near the owning package, such as `apps/api/test/messages.test.ts` or `apps/web/src/test/App.test.tsx`. Web tests use Testing Library with jsdom. E2E tests use Playwright specs under `tests/e2e`; keep assertions user-visible and seed-dependent.

## Commit & Pull Request Guidelines

The current history only has `initial commit`, so use clear, imperative commit subjects such as `Add release gate validation`. Pull requests should explain the change, list verification commands run, link any related issue, and include screenshots or Playwright traces for UI changes. Note Prisma schema or environment changes explicitly.

## Security & Configuration Tips

Do not commit `.env`, local SQLite databases, tokens, or Playwright output. Use `.env.example` values for local development only, including `viewer-local-token` and agent tokens.
