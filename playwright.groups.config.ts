import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "group-conferences.spec.ts",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8097",
    ...devices["iPhone 13"],
    browserName: "webkit",
  },
  webServer: {
    command: "npm run dev -- --port 8097 --host 127.0.0.1",
    url: "http://127.0.0.1:8097",
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-only",
    },
  },
});
