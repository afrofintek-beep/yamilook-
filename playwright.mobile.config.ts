import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: ['mobile-controls.spec.ts', 'papos-languages.spec.ts', 'call-recovery.spec.ts'], workers: 1,
  reporter: 'list', use: { baseURL: 'http://localhost:8089', ...devices['iPhone 13'], browserName: 'webkit' },
  webServer: {
    command: 'npm run dev -- --port 8089 --host 127.0.0.1', url: 'http://localhost:8089',
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-only' },
  },
});
