// The federated return may carry an error slug in the URL. Rendering is only
// ever allowed through this closed dictionary: a known slug resolves to its
// auth-namespace message key, anything else falls back to the generic error
// key, and the raw slug is never shown to the user.
const OAUTH_ERROR_SLUG_TO_I18N_KEY: Readonly<Record<string, string>> = {
  'github-no-verified-email': 'auth:githubNoVerifiedEmail',
  'github-oauth-failed': 'auth:githubOauthFailed',
} as const;

const OAUTH_ERROR_FALLBACK_KEY = 'errors:generic';

export function resolveOauthErrorKey(slug: string | null): string | null {
  if (!slug) return null;
  return OAUTH_ERROR_SLUG_TO_I18N_KEY[slug] ?? OAUTH_ERROR_FALLBACK_KEY;
}
