import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'export.spec.mjs', timeout: 120000, workers: 1,
  outputDir: '../../test-results/branded-export',
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5173', url:'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
