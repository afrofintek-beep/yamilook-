import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'translations.spec.ts',
  outputDir: '../../test-results/documentation',
  fullyParallel: true,
  workers: 2,
  timeout: 90_000,
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
  },
});
