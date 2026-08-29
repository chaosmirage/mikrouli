import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Single source of truth for the API's rate-limit policy: the throttler names,
 * every designed budget, and the module options builder the app boots with.
 *
 * This is a deliberately isolated leaf (only `@nestjs/throttler` types are
 * imported, nothing from the feature graph). Names previously lived in
 * `app.module.ts` and were imported back by the auth/redirect controllers,
 * which resolved them to `undefined` at decorator time — every named override
 * silently no-opped and the strict module-level `auth` value taxed every route.
 * A leaf that cannot import controllers makes that class of failure impossible
 * by construction.
 *
 * Governing mechanic (@nestjs/throttler 6.x ThrottlerGuard): every declared
 * throttler is evaluated for every route. A route's effective budget is the
 * MINIMUM over all non-skipped names — `@Throttle` replaces one name's budget
 * on that route, `@SkipThrottle({ name: true })` sheds one name. The policy is
 * therefore shaped fail-safe: liberal module floors, route-level tightenings
 * where the attack surface is (credential entry, guest-admissible creation),
 * and skip-to-select so authenticated data routes run under the generous
 * `data` budget alone. A future route that forgets a skip degrades to the
 * liberal floor; one that forgets a tightening still gets the floor — never an
 * unbounded route, and never the historical per-IP tax on data traffic.
 *
 * Counters are in-memory per pod; effective budgets multiply by pod count.
 */

export const DEFAULT_THROTTLE_NAME = 'default';
export const AUTH_THROTTLE_NAME = 'auth';
export const REDIRECT_THROTTLE_NAME = 'redirect';
export const DATA_THROTTLE_NAME = 'data';

/** Liberal floors: bounds for any route that declares nothing of its own. */
export const DEFAULT_MODULE_BUDGET = { limit: 300, ttl: 60_000 } as const;
/** Exists for route-level tightening only — equal to the default floor so it
 * never taxes non-auth routes through the min-rule. */
export const AUTH_MODULE_BUDGET = { limit: 300, ttl: 60_000 } as const;
/** The redirect hot path's designed budget, also its own module floor. */
export const REDIRECT_MODULE_BUDGET = { limit: 120, ttl: 10_000 } as const;
/** The authenticated budget — a human session and the full one-IP e2e suite
 * (~<=450 API calls/min worst case) sit far below it. */
export const DATA_MODULE_BUDGET = { limit: 1000, ttl: 60_000 } as const;

/** Credential entry (register / login / refresh / github / github-callback):
 * brute force gets 10 attempts per minute per IP. */
export const AUTH_CREDENTIAL_BUDGET = { limit: 10, ttl: 60_000 } as const;
/** The redirect hot path's route override — sheds the stricter names via
 * `@SkipThrottle` so this budget alone governs. */
export const REDIRECT_HOT_PATH_BUDGET = { limit: 120, ttl: 10_000 } as const;
/** Anonymous link creation: guest POST /api/urls skips the quota check and the
 * origin check is spoofable, so this per-IP override is the ONLY abuse bound
 * on that route — a deliberate bound, kept at today's effective value. */
export const GUEST_CREATE_BUDGET = { limit: 30, ttl: 60_000 } as const;

/** Builds the module options both the app and the guard-driven specs consume —
 * one object, so the spec fixture can never drift from the booted policy. */
export function buildThrottlerOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: DEFAULT_THROTTLE_NAME, ...DEFAULT_MODULE_BUDGET },
      { name: AUTH_THROTTLE_NAME, ...AUTH_MODULE_BUDGET },
      { name: REDIRECT_THROTTLE_NAME, ...REDIRECT_MODULE_BUDGET },
      { name: DATA_THROTTLE_NAME, ...DATA_MODULE_BUDGET },
    ],
  };
}
