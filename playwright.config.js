// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const testPort = Number(process.env.TEST_PORT || 3000);
const testBaseUrl = `http://localhost:${testPort}`;

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: testBaseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: `PORT=${testPort} APP_URL=${testBaseUrl} npm start`,
    url: testBaseUrl,
    reuseExistingServer: !process.env.CI && testPort === 3000,
  },
});
