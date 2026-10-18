import { defineConfig, devices } from '@playwright/test'

const E2E_PORT = 4175
const E2E_HOST = '127.0.0.1'
const E2E_BASE_URL = `http://${E2E_HOST}:${E2E_PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run dev:e2e`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /\.mobile\.spec\.ts$/,
    },
    {
      // Phone layout (touch, mobile user agent); runs only the *.mobile.spec.ts files.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /\.mobile\.spec\.ts$/,
    },
  ],
})
