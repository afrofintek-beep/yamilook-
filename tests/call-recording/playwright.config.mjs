import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch:'recording.spec.mjs', timeout:45000, workers:1,
  outputDir:'../../test-results/call-recording',
  use:{baseURL:'http://127.0.0.1:5173'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},
});
