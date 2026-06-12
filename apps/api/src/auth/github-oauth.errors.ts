import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Response } from 'express';

// The thin value that crosses from GithubStrategy.validate into application code.
// Contains only what is needed for account resolution — no raw passport types leak through.
export interface GithubIdentity {
  provider: 'github';
  providerUserId: string;
  email: string;
}

// Slug vocabulary enumerated once here; all transports (JSON body, redirect query) draw from this.
const SLUG_GITHUB_NO_VERIFIED_EMAIL = 'github-no-verified-email';
const SLUG_GITHUB_OAUTH_FAILED = 'github-oauth-failed';

// Thrown when the GitHub identity has no verified email address (RFC 9457 422).
// Detail text is generic to avoid revealing whether a related account exists.
export class GithubNoVerifiedEmailError extends UnprocessableEntityException {
  constructor() {
    super({
      kind: 'problem',
      typeSlug: SLUG_GITHUB_NO_VERIFIED_EMAIL,
      title: 'No Verified Email',
      detail: 'This GitHub account has no verified email address.',
    });
  }
}

// Thrown when the OAuth flow fails at the guard phase (denied consent, bad/replayed
// state, code exchange failure, or network error fetching verified emails).
// The 401 status plus a generic detail string make it indistinguishable from
// other authorization failures — nothing reveals the specific cause.
export class GithubOauthFailedError extends UnauthorizedException {
  constructor() {
    super({
      kind: 'problem',
      typeSlug: SLUG_GITHUB_OAUTH_FAILED,
      title: 'OAuth Authentication Failed',
      detail: 'GitHub authentication could not be completed.',
    });
  }
}

// Route-scoped filter applied only to the callback handler.
// Maps the two typed OAuth failures to 302 /login?error=<slug> with no cookies.
// Every other exception falls through to the global ProblemDetailsFilter.
// Redirect targets are a fixed allowlist of two relative paths; the slug value
// is drawn from the enumerated vocabulary above — nothing user-controlled is reflected.
@Catch(GithubNoVerifiedEmailError, GithubOauthFailedError)
export class GithubOauthRedirectFilter implements ExceptionFilter {
  catch(exception: GithubNoVerifiedEmailError | GithubOauthFailedError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const response = exception.getResponse() as { typeSlug: string };
    res.redirect(302, `/login?error=${response.typeSlug}`);
  }
}
