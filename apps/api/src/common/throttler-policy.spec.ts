import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerException, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from '../auth/auth.controller';
import { LinksController } from '../links/links.controller';
import { RedirectController } from '../redirect/redirect.controller';
import { CredentialedRequestThrottlerGuard } from './credentialed-request-throttler.guard';
import {
  AUTH_CREDENTIAL_BUDGET,
  AUTH_REFRESH_BUDGET,
  DEFAULT_MODULE_BUDGET,
  DATA_MODULE_BUDGET,
  GUEST_CREATE_BUDGET,
  REDIRECT_HOT_PATH_BUDGET,
  REDIRECT_THROTTLE_NAME,
  buildThrottlerOptions,
} from './throttler-policy';

// Guard-driven policy specs: the historical throttler defect was a
// decorator-time no-op (names resolved to undefined through an import cycle)
// that left every named override inert — invisible to metadata assertions and
// only observable at the guard's allow/deny seam, which is what becomes
// HTTP 429. These specs drive the REAL ThrottlerGuard with the same module
// options the app boots with (built from the shared policy), against the real
// controllers' handler metadata, and observe the decision plus the emitted
// X-RateLimit headers — the outputs a client actually receives.
describe('Throttler policy', () => {
  type HandlerFn = (...args: never[]) => unknown;
  type ControllerCtor = new (...args: never[]) => unknown;

  /** Builds an HTTP context whose response collects the guard's headers. */
  function buildHttpContext(
    controller: ControllerCtor,
    handler: HandlerFn,
    request: {
      ip?: string;
      headers?: Record<string, string>;
      cookies?: Record<string, string>;
    } = {},
  ): {
    context: ExecutionContext;
    headers: Map<string, unknown>;
  } {
    const headers = new Map<string, unknown>();
    const context = {
      getClass: () => controller,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '203.0.113.7',
          headers: {},
          cookies: {},
          ...request,
        }),
        getResponse: () => ({
          header: (name: string, value: unknown) => {
            headers.set(name, value);
          },
        }),
      }),
    } as unknown as ExecutionContext;
    return { context, headers };
  }

  /** Resolves the guard the app boots, driven with the booted policy options. */
  async function resolveGuard(): Promise<ThrottlerGuard> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(buildThrottlerOptions())],
      providers: [{ provide: ThrottlerGuard, useClass: CredentialedRequestThrottlerGuard }],
    }).compile();
    const guard = moduleRef.get<ThrottlerGuard>(ThrottlerGuard);
    await guard.onModuleInit();
    return guard;
  }

  /** Runs canActivate until the first denial; returns its 1-based hit number. */
  async function firstDeniedHit(guard: ThrottlerGuard, context: ExecutionContext): Promise<number> {
    for (let hit = 1; hit <= DATA_MODULE_BUDGET.limit + 10; hit++) {
      try {
        await guard.canActivate(context);
      } catch (error) {
        if (!(error instanceof ThrottlerException)) throw error;
        return hit;
      }
    }
    throw new Error('no throttler denied the route — the budget is missing');
  }

  it('GET /:slug runs on the redirect budget alone (the skips shed the other names)', async () => {
    const guard = await resolveGuard();
    const { context, headers } = buildHttpContext(
      RedirectController,
      RedirectController.prototype.redirect,
    );

    const deniedAt = await firstDeniedHit(guard, context);

    // The redirect budget binds: denied exactly one past its 120/10s limit...
    expect(deniedAt).toBe(REDIRECT_HOT_PATH_BUDGET.limit + 1);
    // ...and no other name was ever evaluated — every emitted rate-limit
    // header is redirect-suffixed, so the skip map shed default/auth/data.
    // Without the skips the min-rule would cap the hot path at the stricter
    // 300/60s default floor and emit the bare default header as well.
    expect(headers.has('X-RateLimit-Limit')).toBe(false);
    expect(headers.has('X-RateLimit-Limit-auth')).toBe(false);
    expect(headers.has('X-RateLimit-Limit-data')).toBe(false);
    expect(headers.get(`X-RateLimit-Limit-${REDIRECT_THROTTLE_NAME}`)).toBe(
      REDIRECT_HOT_PATH_BUDGET.limit,
    );
  });

  it('GET /api/urls survives rapid traffic past every public floor and still has a budget', async () => {
    const guard = await resolveGuard();
    const { context, headers } = buildHttpContext(LinksController, LinksController.prototype.list);

    const deniedAt = await firstDeniedHit(guard, context);

    // The regression behind the e2e 429s: authenticated list traffic must stay
    // available far past the liberal default floor (and the historical
    // effective 30/min tax) yet remain bounded by the data budget — available
    // past the floor, denied at data + 1, never skipped into nothing.
    expect(deniedAt).toBeGreaterThan(DEFAULT_MODULE_BUDGET.limit);
    expect(deniedAt).toBe(DATA_MODULE_BUDGET.limit + 1);
    // Only the data name binds on this route (default/auth/redirect skipped).
    expect(headers.has('X-RateLimit-Limit')).toBe(false);
    expect(headers.has('X-RateLimit-Limit-auth')).toBe(false);
    expect(headers.has('X-RateLimit-Limit-redirect')).toBe(false);
    expect(headers.get('X-RateLimit-Limit-data')).toBe(DATA_MODULE_BUDGET.limit);
  });

  it('POST /api/urls denies exactly at hit 31/min — the guest abuse bound', async () => {
    const guard = await resolveGuard();
    const { context, headers } = buildHttpContext(
      LinksController,
      LinksController.prototype.create,
    );

    const deniedAt = await firstDeniedHit(guard, context);

    // Guest creation skips the quota check and the origin check is spoofable,
    // so the per-IP default-name override is the ONLY abuse bound on this
    // route: 30 creations allowed per minute, the 31st denied.
    expect(deniedAt).toBe(GUEST_CREATE_BUDGET.limit + 1);
    // The override must actually replace the module floor: the bare default
    // header carries the tightened 30, never the liberal floor's 300.
    expect(headers.get('X-RateLimit-Limit')).toBe(GUEST_CREATE_BUDGET.limit);
  });

  // Each credential form the API accepts must shed the guest-admission bound:
  // the session cookie is how the SPA authenticates, the other two cover API
  // clients. All three drive the same route, so each gets its own address.
  const CREDENTIALED_REQUESTS: Array<[string, Record<string, string>, Record<string, string>]> = [
    ['a session cookie', {}, { mikrouli_access: 'session.jwt' }],
    ['a Bearer token', { authorization: 'Bearer access.jwt' }, {}],
    ['an API key', { 'x-api-key': 'mk_live_key' }, {}],
  ];

  for (const [credentialForm, headers, cookies] of CREDENTIALED_REQUESTS) {
    it(`POST /api/urls with ${credentialForm} runs on the data budget, not the guest bound`, async () => {
      const guard = await resolveGuard();
      const { context, headers: emitted } = buildHttpContext(
        LinksController,
        LinksController.prototype.create,
        { ip: '198.51.100.4', headers, cookies },
      );

      const deniedAt = await firstDeniedHit(guard, context);

      // A credentialed request is not a guest: it must stay available past the
      // guest bound (the 30/min tax that denied registered-user traffic) and
      // still be bounded — by the data budget, exactly like the route's other
      // authenticated operations.
      expect(deniedAt).toBeGreaterThan(GUEST_CREATE_BUDGET.limit);
      expect(deniedAt).toBe(DATA_MODULE_BUDGET.limit + 1);
      // The public names were shed, not merely loosened: no counter header for
      // default/auth/redirect is emitted, only the data one.
      expect(emitted.has('X-RateLimit-Limit')).toBe(false);
      expect(emitted.has('X-RateLimit-Limit-auth')).toBe(false);
      expect(emitted.has('X-RateLimit-Limit-redirect')).toBe(false);
      expect(emitted.get('X-RateLimit-Limit-data')).toBe(DATA_MODULE_BUDGET.limit);
    });
  }

  it('POST /api/auth/refresh denies at its own rotation budget, not the credential-entry bound', async () => {
    const guard = await resolveGuard();
    const { context } = buildHttpContext(AuthController, AuthController.prototype.refresh);

    const deniedAt = await firstDeniedHit(guard, context);

    // Session rotation presents a server-issued cookie, not a guessable
    // password, so it does not share the brute-force bound: it allows its own
    // budget's worth of rotations per minute and denies the next one.
    expect(deniedAt).toBe(AUTH_REFRESH_BUDGET.limit + 1);
  });

  it('exhausting the credential-entry budget on login leaves session rotation available', async () => {
    const guard = await resolveGuard();
    const { context: loginContext } = buildHttpContext(
      AuthController,
      AuthController.prototype.login,
    );

    // Burn the whole credential-entry window: every hit up to the budget
    // passes, the next is denied inside it.
    for (let hit = 0; hit < AUTH_CREDENTIAL_BUDGET.limit; hit++) {
      await expect(guard.canActivate(loginContext)).resolves.toBe(true);
    }
    await expect(guard.canActivate(loginContext)).rejects.toBeInstanceOf(ThrottlerException);

    // The two surfaces hold independent counters: a locked-out login window
    // must not take rotation down with it, or every session behind one
    // address loses its ability to stay signed in.
    const { context: refreshContext } = buildHttpContext(
      AuthController,
      AuthController.prototype.refresh,
    );
    await expect(guard.canActivate(refreshContext)).resolves.toBe(true);
  });
});
