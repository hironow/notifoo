/// <reference types="node" />
import { defineConfig, devices } from "@playwright/test";

const PUSH_SERVER_PORT = 3001;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: [
        `cd server && npm run build &&`,
        `PORT=${PUSH_SERVER_PORT}`,
        "VAPID_PUBLIC_KEY=BMlhI-USgEOyTW9WYGY9MrEj-KqKFLV2bKPjoOpum_pxmUj5A9NrrFSvxo2nP7AOjLWSv63EInxcTAvVHd24ypk",
        "VAPID_PRIVATE_KEY=RROuDTQjFU1nilddkzSv8PmBXC4EL5UOg7sXAIbM81U",
        "node dist/index.js",
      ].join(" "),
      port: PUSH_SERVER_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `VITE_PUSH_API_URL=http://localhost:${PUSH_SERVER_PORT} vp build && vp preview --port 4173`,
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
