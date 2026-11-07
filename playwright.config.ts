import { defineConfig, devices } from '@playwright/test'

const E2E_PORT = 4175
const E2E_HOST = '127.0.0.1'
const E2E_BASE_URL = `http://${E2E_HOST}:${E2E_PORT}`
const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  // One retry shows whether a failure is flaky (the trace is recorded on it), but a test that
  // only passes on retry still fails the CI run.
  retries: CI ? 1 : 0,
  failOnFlakyTests: CI,
  workers: CI ? 1 : undefined,
  reporter: CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run dev:e2e`,
    url: E2E_BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // *.prod.spec.ts measure the production build (playwright.startup.config.ts).
      testIgnore: [/\.mobile\.spec\.ts$/, /\.prod\.spec\.ts$/],
    },
    {
      // Phone layout (touch, mobile user agent); runs only the *.mobile.spec.ts files.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /\.mobile\.spec\.ts$/,
    },
  ],
})
