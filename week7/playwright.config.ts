import { defineConfig } from '@playwright/test';

const port = Number(process.env['E2E_PORT'] ?? 4310);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    channel: process.env['E2E_CHANNEL'] ?? 'msedge',
  },
  webServer: {
    command: 'node dist/src/server.js',
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(port),
      HOST: '127.0.0.1',
      CAMPUS_DATA: 'data/e2e-campus.json',
      CURRENT_TERM: '115-1',
      NODE_ENV: 'test',
    },
  },
});
