import { Injectable } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
// passport-github2 re-exports from passport-oauth2 for the StateStore type
import { Strategy } from 'passport-github2';
import type { StateStoreStoreCallback, StateStoreVerifyCallback } from 'passport-oauth2';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';
import {
  GithubIdentity,
  GithubNoVerifiedEmailError,
  GithubOauthFailedError,
} from './github-oauth.errors';

// Redis key namespace and TTL for single-use OAuth state tokens.
// 10 minutes covers the GitHub login + 2FA flow while bounding the replay window.
const OAUTH_STATE_KEY_PREFIX = 'auth:oauth:state:';
const OAUTH_STATE_TTL_SECONDS = 600;

// GitHub verified-emails API endpoint. passport-github2's profile.emails does
// not carry verified flags, so we call this directly with the access token.
const GITHUB_EMAILS_API = 'https://api.github.com/user/emails';

interface GithubEmail {
  email: string;
  verified: boolean;
  primary: boolean;
}

// Selects the best verified email from the list returned by the GitHub emails API.
// Prefers primary+verified; falls back to first verified; returns null if none.
function selectVerifiedEmail(emails: GithubEmail[]): string | null {
  const verified = emails.filter((e) => e.verified);
  if (verified.length === 0) return null;
  const primary = verified.find((e) => e.primary);
  return (primary ?? verified[0]).email;
}

// passport-oauth2 pluggable StateStore backed by Redis.
// store() mints a 32-byte hex token (256 bits of entropy) with a short TTL.
// verify() atomically reads-and-deletes the token (GETDEL) so it validates
// at most once, closing the race window where two concurrent callbacks could
// both pass. Any Redis error propagates fail-closed — no unverified continuation.
class GithubStateStore {
  constructor(private readonly redisService: RedisService) {}

  store(_req: unknown, cb: StateStoreStoreCallback): void {
    const token = crypto.randomBytes(32).toString('hex');
    const key = `${OAUTH_STATE_KEY_PREFIX}${token}`;
    this.redisService
      .setOrThrow(key, '1', OAUTH_STATE_TTL_SECONDS)
      .then(() => cb(null, token))
      .catch((err: unknown) => cb(err instanceof Error ? err : new Error(String(err)), token));
  }

  verify(_req: unknown, providedState: string, cb: StateStoreVerifyCallback): void {
    const key = `${OAUTH_STATE_KEY_PREFIX}${providedState}`;
    this.redisService
      .getDelOrThrow(key)
      .then((value) => {
        if (value === null) {
          // Token absent: expired, already consumed, or never issued.
          cb(null, false, 'Invalid or expired OAuth state token');
        } else {
          cb(null, true, providedState);
        }
      })
      .catch((err: unknown) => cb(err instanceof Error ? err : new Error(String(err)), false, ''));
  }
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(configService: ConfigService, redisService?: RedisService) {
    super({
      clientID: configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
      // Plug in our Redis-backed state store instead of passport-oauth2's
      // default session-based store (which would require express-session).
      store: redisService ? new GithubStateStore(redisService) : undefined,
    });
  }

  // Called by passport after the code exchange succeeds.
  // Selects a verified email before any account resolution, then returns the
  // thin GithubIdentity value object — no raw passport types cross this
  // boundary into application code.
  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: { id: string },
    done: (err: unknown, user?: GithubIdentity | false) => void,
  ): Promise<void> {
    let emails: GithubEmail[];
    try {
      emails = await this._fetchGithubEmails(accessToken);
    } catch {
      // Network or non-2xx error fetching verified emails — no session issued.
      done(new GithubOauthFailedError(), undefined);
      return;
    }

    const email = selectVerifiedEmail(emails);
    if (!email) {
      // Refuse when no verified email is available — before any UsersService call.
      done(new GithubNoVerifiedEmailError(), undefined);
      return;
    }

    done(null, { provider: 'github', providerUserId: profile.id, email });
  }

  // Fetches verified email addresses from the GitHub API using the access token.
  // Extracted as a separate method so tests can stub it without mocking fetch globally.
  async _fetchGithubEmails(accessToken: string): Promise<GithubEmail[]> {
    const resp = await fetch(GITHUB_EMAILS_API, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!resp.ok) {
      throw new Error(`GitHub emails API returned ${String(resp.status)}`);
    }
    return resp.json() as Promise<GithubEmail[]>;
  }
}

// Decorates both OAuth routes.
// On GET /auth/github: redirects to GitHub before the handler body runs.
// On GET /auth/github/callback: exchanges the code and calls validate().
// handleRequest override re-throws guard-phase failures (denied consent,
// bad/replayed state, exchange failure) as GithubOauthFailedError so the
// route-scoped GithubOauthRedirectFilter sees one error vocabulary.
@Injectable()
export class GithubOauthGuard extends AuthGuard('github') {
  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) {
      throw new GithubOauthFailedError();
    }
    return user;
  }
}
