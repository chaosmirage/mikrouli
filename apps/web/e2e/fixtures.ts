import { test as base, expect, request as playwrightRequest } from '@playwright/test';
import type { Page, APIRequestContext, APIResponse } from '@playwright/test';
import { SHARED_EMAIL, SHARED_PASSWORD } from './shared-auth-constants';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8888';
const STRONG_PASSWORD = 'Test1234!';
const RANDOM_SUFFIX_CHARS = 6;

export function randomEmail(): string {
  const suffix = Math.random()
    .toString(36)
    .slice(2, 2 + RANDOM_SUFFIX_CHARS);
  return `e2e_${Date.now()}_${suffix}@example.com`;
}

export function strongPassword(): string {
  return STRONG_PASSWORD;
}

export interface AuthResult {
  email: string;
  password: string;
}

export interface ApiCallOptions {
  headers?: Record<string, string>;
  data?: Record<string, unknown>;
  noAuth?: boolean;
  maxRedirects?: number;
}

async function navigateAndRegister(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/register');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill(password);
  await page.getByTestId('register-submit').click();
  await page.waitForURL('**/login');
}

async function loginAndAwaitDashboard(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/dashboard');
}

export async function registerAndLogin(
  page: Page,
  email?: string,
  password?: string,
): Promise<AuthResult> {
  const userEmail = email ?? randomEmail();
  const userPassword = password ?? strongPassword();
  await navigateAndRegister(page, userEmail, userPassword);
  await loginAndAwaitDashboard(page, userEmail, userPassword);
  return { email: userEmail, password: userPassword };
}

// Makes an API call using a standalone request context (no browser cookies).
// Use this for unauthenticated probes, X-API-Key requests, or cross-user checks.
export async function apiCall(
  request: APIRequestContext,
  method: string,
  path: string,
  opts?: ApiCallOptions,
): Promise<APIResponse> {
  return request.fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    data: opts?.data,
    maxRedirects: opts?.maxRedirects,
  });
}

export interface ApiClient {
  call(method: string, path: string, opts?: ApiCallOptions): Promise<APIResponse>;
}

interface E2EFixtures {
  auth: AuthResult;
  api: ApiClient;
  unauthRequest: APIRequestContext;
}

export const test = base.extend<E2EFixtures>({
  // A standalone request context that holds no session cookies — used by the
  // api fixture's noAuth path and available directly to specs that need it.
  unauthRequest: async ({}, use) => {
    // Explicitly empty storageState prevents the project-level storageState
    // (shared session) from being inherited by this cookie-free context.
    const ctx = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      storageState: { cookies: [], origins: [] },
    });
    await use(ctx);
    await ctx.dispose();
  },

  auth: async ({ page }, use) => {
    // The shared session cookies are loaded from storageState (set by the setup
    // project) into the browser context before this fixture runs. Navigate to the
    // dashboard so the page is in the correct state for tests that interact with
    // the dashboard UI.
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard');
    await use({ email: SHARED_EMAIL, password: SHARED_PASSWORD });
  },

  api: async ({ page, unauthRequest, auth: _auth }, use) => {
    // The auth fixture dependency ensures: (1) the browser context carries the
    // shared session cookies, and (2) the page is navigated to /dashboard before
    // the test body runs — required by tests that call page.reload() to see the
    // updated link table after an API call.
    // Authenticated calls use page.request, which shares the browser context's
    // cookie store (populated during the auth fixture's navigation).
    // noAuth calls use the separate unauthRequest context that holds no cookies,
    // suitable for X-API-Key calls and unauthenticated probes.
    const client: ApiClient = {
      call(method: string, path: string, opts?: ApiCallOptions): Promise<APIResponse> {
        const { noAuth = false, headers: extraHeaders, data, maxRedirects } = opts ?? {};
        const fetchOpts = {
          method,
          headers: { 'Content-Type': 'application/json', ...extraHeaders },
          data,
          maxRedirects,
        };
        if (noAuth) {
          return unauthRequest.fetch(`${BASE_URL}${path}`, fetchOpts);
        }
        return page.request.fetch(`${BASE_URL}${path}`, fetchOpts);
      },
    };
    await use(client);
  },
});

export { expect };
