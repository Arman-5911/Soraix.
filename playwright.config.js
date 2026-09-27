import { defineConfig } from "@playwright/test";
export default defineConfig({
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 60000,
  },
  testDir: "./tests/browser",
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  reporter: "list",
  workers: 1,
});
