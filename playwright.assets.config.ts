import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'asset-recovery.spec.ts', workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8093', ...devices['iPhone 13'], browserName: 'webkit', serviceWorkers: 'block' },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 8093',
    url: 'http://127.0.0.1:8093', timeout: 120_000,
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-only' },
  },
});
