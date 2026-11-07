import { defineConfig, devices } from '@playwright/test'

/**
 * Startup budget on the production build: `npx vite build` first, then
 * `npx playwright test -c playwright.startup.config.ts`. Separate from playwright.config.ts,
 * whose tests run against the dev server.
 */
const PORT = 4176
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  testMatch: /\.prod\.spec\.ts$/,
  forbidOnly: !!process.env.CI,
  // One test at a time: parallel page loads would slow each other down.
  workers: 1,
  reporter: 'list',
  use: { baseURL: BASE_URL },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
