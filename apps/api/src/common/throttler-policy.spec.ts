import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerException, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LinksController } from '../links/links.controller';
import { RedirectController } from '../redirect/redirect.controller';
import {
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
  ): {
    context: ExecutionContext;
    headers: Map<string, unknown>;
  } {
    const headers = new Map<string, unknown>();
    const context = {
      getClass: () => controller,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ ip: '203.0.113.7', headers: {} }),
        getResponse: () => ({
          header: (name: string, value: unknown) => {
            headers.set(name, value);
          },
        }),
      }),
    } as unknown as ExecutionContext;
    return { context, headers };
  }

  async function resolveGuard(): Promise<ThrottlerGuard> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(buildThrottlerOptions())],
      providers: [{ provide: ThrottlerGuard, useClass: ThrottlerGuard }],
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
});
