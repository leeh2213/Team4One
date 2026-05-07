import { defineConfig, devices } from "@playwright/test";

const pnpm =
  "TMPDIR=/tmp COREPACK_HOME=/tmp/corepack PNPM_HOME=/tmp/pnpm-home pnpm --config.virtual-store-dir=/tmp/team4one-pnpm-virtual-store";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command:
        `${pnpm} --filter @team4one/api seed && ` +
        `DATABASE_URL=file:./dev.db ${pnpm} --filter @team4one/api dev`,
      url: "http://127.0.0.1:4100/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "VITE_API_BASE_URL=http://127.0.0.1:4100 VITE_SPACE_ID=seed-space-vessel-tracking VITE_API_TOKEN=viewer-local-token " +
        `${pnpm} --filter @team4one/web dev`,
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
