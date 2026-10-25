import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'status-upload.spec.ts',workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:8094',...devices['iPhone 13'],browserName:'webkit'},webServer:{command:'npx vite --config e2e/status-upload/vite.config.ts',url:'http://127.0.0.1:8094/e2e/status-upload/index.html'}});
