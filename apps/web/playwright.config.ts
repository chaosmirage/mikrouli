import { defineConfig, devices } from '@playwright/test';

const TIMEOUT_MS = 30_000;
const EXPECT_TIMEOUT_MS = 5_000;
const CI_RETRIES = 2;
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8888';

const CHROMIUM_PROJECT = {
  name: 'chromium',
  use: { ...devices['Desktop Chrome'] },
};

export default defineConfig({
  testDir: './e2e',
  timeout: TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  fullyParallel: true,
  retries: process.env.CI ? CI_RETRIES : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [CHROMIUM_PROJECT],
});
