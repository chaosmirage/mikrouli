// The session cookie the auth flow sets for browser clients. Declared here,
// not imported from the auth service, so this leaf stays free of the feature
// graph and both of its consumers (guest admission, the throttler guard)
// resolve it without a cycle.
const ACCESS_COOKIE_NAME = 'mikrouli_access';

/** The minimal request shape credential detection reads — deliberately not the
 * full Express request, so the predicate depends on data, not a framework. */
export interface CredentialBearingRequest {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
}

/**
 * Answers whether the request carries any credential the API recognises: a
 * Bearer access token, an API key, or the session access cookie.
 *
 * Guest admission and the rate-limit policy both branch on actor type (guest
 * vs credentialed) before authentication has run, so they must reach the same
 * verdict from the raw request — this predicate is that single answer. It
 * detects PRESENCE only: validity is decided later by the auth guards, so a
 * forged credential buys nothing in practice — the request is refused before
 * it can create anything.
 */
export function carriesApiCredential(req: CredentialBearingRequest): boolean {
  const authorization = req.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) return true;
  if (req.headers['x-api-key']) return true;
  return Boolean(req.cookies?.[ACCESS_COOKIE_NAME]);
}
