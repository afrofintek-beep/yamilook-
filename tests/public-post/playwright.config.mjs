import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['handoff.spec.mjs', 'file-picker.spec.mjs'], workers: 1,
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
});
