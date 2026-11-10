import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: '.', testMatch: 'editor.spec.ts', timeout: 30000, workers: 2,
 projects: [{ name: 'chromium', use: { browserName: 'chromium', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} } }, { name: 'webkit', use: { browserName: 'webkit' } }],
 use: { baseURL: 'http://127.0.0.1:5176', viewport: { width: 393, height: 852 }, screenshot: 'only-on-failure' },
 webServer: { cwd: new URL('../..', import.meta.url).pathname, command: 'npx vite --config tests/post-editor/vite.config.ts --host 127.0.0.1 --port 5176', url: 'http://127.0.0.1:5176/tests/post-editor/harness.html' },
});
