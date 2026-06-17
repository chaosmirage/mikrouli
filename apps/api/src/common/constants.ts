export const GLOBAL_LINK_LIMIT = 100;
export const GLOBAL_KEY_LIMIT = 10;
export const RETENTION_MS = 94_608_000_000; // 3 * 365 * 24 * 60 * 60 * 1000

// Deterministic sentinel email for the single shared Guest pseudo-identity row.
// The Guest row is seeded once by the SeedGuestUser migration and resolved at
// runtime by UsersService.getGuestUserId(). Sharing one constant between the
// migration and the resolver keeps the sentinel stable across deploys.
export const GUEST_SENTINEL_EMAIL = 'guest@mikrouli.local';
