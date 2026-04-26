import { test as base, expect } from '@playwright/test';
import type { Page, APIRequestContext, APIResponse } from '@playwright/test';

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
  accessToken: string | null;
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
  const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
  return { email: userEmail, password: userPassword, accessToken };
}

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
}

export const test = base.extend<E2EFixtures>({
  auth: async ({ page }, use) => {
    const result = await registerAndLogin(page);
    await use(result);
  },

  api: async ({ request, auth }, use) => {
    const client: ApiClient = {
      call(method: string, path: string, opts?: ApiCallOptions): Promise<APIResponse> {
        const { noAuth = false, headers: extraHeaders, ...rest } = opts ?? {};
        const authHeader =
          noAuth || auth.accessToken === null
            ? {}
            : { Authorization: `Bearer ${auth.accessToken}` };
        return apiCall(request, method, path, {
          ...rest,
          headers: { ...authHeader, ...extraHeaders },
        });
      },
    };
    await use(client);
  },
});

export { expect };
