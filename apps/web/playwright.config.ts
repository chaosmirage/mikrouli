import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import * as path from 'path';

const TIMEOUT_MS = 30_000;
const EXPECT_TIMEOUT_MS = 5_000;
const CI_RETRIES = 2;
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8888';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_AUTH_FILE = path.join(__dirname, 'e2e/.auth/shared-user.json');

export default defineConfig({
  testDir: './e2e',
  timeout: TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? CI_RETRIES : 0,
  // list reporter prints per-test progress to the runner log in real time
  // (default github+html combo stays silent until the end, leaving CI logs
  // blank for the entire run). html stays for the downloadable artifact.
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Global setup: register and log in the shared test user once.
    { name: 'setup', testMatch: /global\.setup\.ts$/ },
    // Main test project: reuses the shared session so most tests skip auth calls.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: SHARED_AUTH_FILE,
      },
      dependencies: ['setup'],
    },
  ],
});
