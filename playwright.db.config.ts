import { defineConfig, devices } from "@playwright/test";

// Database-backed end-to-end suite. Run through `npm run test:e2e:db`, which prepares PostgreSQL,
// provisions an owner, and exports the connection settings used below.
const port = 3108;
export default defineConfig({
  testDir: "./tests/e2e-db",
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure", navigationTimeout: 90_000, actionTimeout: 30_000 },
  webServer: {
    command: `npx next dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...(process.env as Record<string, string>),
      DEMO_MODE: "false",
      NEXT_DIST_DIR: ".next-e2e-db",
      DATABASE_URL: process.env.TEST_DATABASE_APP_URL ?? "",
      APP_BASE_URL: `http://127.0.0.1:${port}`,
      OPENAI_ENABLED: "false",
    },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
