import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'scheduled-calls.spec.ts',workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:8093',...devices['iPhone 13'],browserName:'webkit'},webServer:{command:'npx vite --config e2e/scheduled/vite.config.ts',url:'http://127.0.0.1:8093/e2e/scheduled/index.html'}});
