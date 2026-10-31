import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'feed-responsive.spec.ts', workers: 1,
  reporter: 'list', use: { baseURL: 'http://localhost:8095', browserName: 'chromium', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-gpu']} : undefined },
  webServer: {
    command: 'npm run dev -- --port 8095 --host 127.0.0.1', url: 'http://localhost:8095',
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-only' },
  },
});
