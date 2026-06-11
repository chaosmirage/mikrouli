import { test as setup, request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { SHARED_EMAIL, SHARED_PASSWORD } from './shared-auth-constants';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8888';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_AUTH_FILE = path.join(__dirname, '.auth/shared-user.json');

// Registers the shared test user once (idempotent — ignores 422 if already exists)
// and logs in, saving the session storageState so tests can reuse it without hitting
// the auth throttle.
setup('create shared test user', async () => {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  // Register (idempotent — ignores conflicts).
  await ctx.post('/api/auth/register', {
    headers: { 'Content-Type': 'application/json' },
    data: { email: SHARED_EMAIL, password: SHARED_PASSWORD },
  });

  // Login and capture the Set-Cookie headers.
  const loginResp = await ctx.post('/api/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    data: { email: SHARED_EMAIL, password: SHARED_PASSWORD },
  });

  if (!loginResp.ok()) {
    throw new Error(`Setup login failed: ${loginResp.status()} ${await loginResp.text()}`);
  }

  // Persist the cookie jar to disk; playwright uses it as storageState.
  const dir = path.dirname(SHARED_AUTH_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await ctx.storageState({ path: SHARED_AUTH_FILE });
  await ctx.dispose();
});
