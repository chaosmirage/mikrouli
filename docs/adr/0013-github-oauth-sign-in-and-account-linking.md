# 0013 - GitHub OAuth Sign-In and Account Linking

**Status:** Accepted

## Context

Before this change the only way to obtain a mikrouli account was the
email/password flow: `POST /api/auth/register` created a user with a
bcrypt-hashed password, and `POST /api/auth/login` validated those credentials
(`auth.service.ts`, `users.service.ts`). The `users.password_hash` column was
declared `NOT NULL` (`user.entity.ts`), so every account was required to carry a
password credential.

Adding sign-in through an external identity provider raises three concerns the
password flow does not:

- **CSRF on the OAuth redirect.** The authorization-code flow round-trips
  through the provider and back to a callback URL. Without a per-request state
  token bound to the server, a forged callback could complete a flow the user
  never started.
- **Email trust.** A provider account can list email addresses that are not
  verified. Matching an unverified email against an existing mikrouli account
  would let an attacker take over that account.
- **Account resolution.** A returning OAuth user, an existing
  email/password user signing in with the provider for the first time, and a
  brand-new user must all resolve deterministically — including when two
  requests for the same new identity race.

## Decision

Add **GitHub OAuth sign-in and registration** as a second entry path that
resolves to the same session as credential login, backed by a new
`provider_accounts` table and a nullable `users.password_hash` column.

**Routes and flow.** Two endpoints are added to the `Auth` namespace in
`apps/api/spec/main.tsp` and implemented in `auth.controller.ts`:

- `GET /api/auth/github` is intercepted by `GithubOauthGuard` (a Passport
  `AuthGuard('github')`) which mints a CSRF state token and redirects the
  browser (302) to GitHub's authorization page before the handler body runs.
- `GET /api/auth/github/callback` is guarded by the same guard, which validates
  and consumes the state token, exchanges the authorization code, and runs
  `GithubStrategy.validate`. On success the controller issues the session cookie
  pair (the same `applySessionCookies` path as credential login) and redirects
  302 to `/dashboard`.

**Single-use CSRF state in Redis.** `GithubStrategy` plugs a custom
`passport-oauth2` `StateStore` (`GithubStateStore`) into the strategy instead of
the default session-based store, so no `express-session` is required. `store()`
mints a 32-byte hex token (256 bits of entropy) under
`auth:oauth:state:<token>` with a 600-second TTL. `verify()` reads-and-deletes
the token atomically with a single Redis `GETDEL` (added as
`RedisService.getDelOrThrow`, available since Redis 6.2), so a token validates
at most once and two concurrent callbacks presenting the same state cannot both
pass. Any Redis error propagates fail-closed — the flow does not continue
unverified.

**Verified-email gate.** `passport-github2`'s profile does not carry email
verification flags, so `GithubStrategy.validate` calls the GitHub
`/user/emails` API directly with the access token and selects a verified
address (primary-verified preferred, else first verified). If no verified email
is present it raises `GithubNoVerifiedEmailError` **before any account lookup**,
so an unverified email is never matched against an existing account. Only a thin
`GithubIdentity` value (`provider`, `providerUserId`, `email`) crosses from the
strategy into application code — no raw passport types leak through.

**Account resolution (find-or-create-or-link).**
`UsersService.findOrCreateFromProvider` runs three ordered branches inside a
single transaction (`resolveProviderIdentity`):

1. a `provider_accounts` row already links this `(provider, providerUserId)` →
   return its user (returning user);
2. a `users` row matches the verified email → insert a provider link and return
   that user (link an existing password account);
3. neither matches → insert a user with `password_hash = NULL` and link it
   (first-time sign-up).

On a Postgres `23505` unique violation (a concurrent first-time flow won the
race) the whole transaction is retried exactly once, so the second pass lands
deterministically in branch 1 or 2.

**Schema.** Migration `1700000000004-GithubIdentities` creates
`provider_accounts` (`id`, `provider`, `provider_user_id`, `user_id`,
timestamps) with `ON DELETE CASCADE` to `users`, a unique constraint on
`(provider, provider_user_id)`, and a unique constraint on `(provider, user_id)`
— enforcing one GitHub identity per account at the database level. The same
migration drops `NOT NULL` on `users.password_hash`; the `user.entity.ts` column
becomes `string | null` so strict typing forces every reader to narrow null. The
down migration restores `NOT NULL` before dropping the table, which blocks the
rollback if any password-less account exists.

**Constant-time credential check.** Because OAuth-only accounts now have a null
password, `AuthService.validateCredentials` runs `bcrypt.compare` against a
fixed decoy hash whenever the user is missing or has no `passwordHash`, keeping
the failure response time indistinguishable from a wrong-password attempt and
preventing a timing oracle that would reveal whether an account exists or lacks
a password.

**Typed failures and SPA feedback.** OAuth failures use a fixed slug vocabulary
(`github-no-verified-email`, `github-oauth-failed`) in `github-oauth.errors.ts`.
A route-scoped `GithubOauthRedirectFilter` maps them to `302 /login?error=<slug>`
with no cookies; any other exception falls through to the global RFC 9457
`ProblemDetailsFilter`, which now also recognises slug-carrying problem payloads.
The SPA maps the two known slugs to localized messages and renders nothing for an
unknown slug, never reflecting the raw query value.

## Alternatives Considered

- **Session-based OAuth state (the `passport-oauth2` default):** would require
  adding `express-session` and a session store solely for the state nonce. The
  Redis-backed single-use store reuses the Redis dependency already present for
  refresh-token revocation and gives an explicit one-shot guarantee via `GETDEL`.
- **Trusting the provider's primary email without checking the verified flag:**
  simpler, but an unverified email could be used to take over an existing
  password account. Gating on a verified email before any lookup closes that
  path.
- **A nullable `provider_user_id` column on `users` instead of a join table:**
  would couple every user row to a single provider and complicate adding further
  providers. A separate `provider_accounts` table keeps the provider link
  one-to-one per provider while leaving room to extend the `provider` union.
- **Separate token-issuing logic for OAuth:** rejected in favor of resolving the
  OAuth identity to a `User` and then reusing the existing `issueTokens` join
  point, so an OAuth session is byte-for-byte identical to a credential session.

## Consequences

- A user can sign in or register with GitHub from the login and register pages;
  an existing password account is automatically linked on first GitHub sign-in
  when the verified email matches.
- Accounts can now exist with no password (`password_hash = NULL`). Every reader
  of `passwordHash` must handle null, and credential login against such an
  account fails like any wrong-password attempt.
- The API requires three new configuration values — `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`, and `GITHUB_CALLBACK_URL` — wired through
  `docker-compose.yml` and the k8s API Deployment (the secrets via
  `mikrouli-secrets`, the callback URL as a plain env value per environment).
- A Redis outage during the OAuth flow fails the sign-in closed rather than
  completing it without CSRF protection, consistent with the existing
  fail-closed posture of refresh-token revocation (ADR 0011).
- The migration's down path cannot run once any password-less account exists,
  which is intentional: rolling back would otherwise silently strand OAuth-only
  users with no usable credential.
