import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'upload.spec.mjs', timeout: 60000, workers: 1,
  projects: [{ name:'chromium',use:{browserName:'chromium'} },{name:'webkit',use:{browserName:'webkit'}}],
  use: { baseURL: 'http://127.0.0.1:5174' },
  webServer: { command:'npm run dev -- --host 127.0.0.1 --port 5174',url:'http://127.0.0.1:5174',env:{VITE_SUPABASE_URL:'http://127.0.0.1:54321',VITE_SUPABASE_PUBLISHABLE_KEY:'test-only'} },
});
