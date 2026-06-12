import { GithubNoVerifiedEmailError, GithubOauthFailedError } from './github-oauth.errors';

describe('GithubNoVerifiedEmailError', () => {
  it('carries the correct HTTP status and slug', () => {
    const err = new GithubNoVerifiedEmailError();
    expect(err.getStatus()).toBe(422);
    const response = err.getResponse() as { kind: string; typeSlug: string };
    expect(response.kind).toBe('problem');
    expect(response.typeSlug).toBe('github-no-verified-email');
  });
});

describe('GithubOauthFailedError', () => {
  it('carries the correct HTTP status and slug', () => {
    const err = new GithubOauthFailedError();
    expect(err.getStatus()).toBe(401);
    const response = err.getResponse() as { kind: string; typeSlug: string };
    expect(response.kind).toBe('problem');
    expect(response.typeSlug).toBe('github-oauth-failed');
  });
});
