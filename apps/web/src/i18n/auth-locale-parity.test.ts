import { describe, it, expect } from 'vitest';
import enAuth from './locales/en/auth.json';
import deAuth from './locales/de/auth.json';
import elAuth from './locales/el/auth.json';

// All three auth locale files must have identical key sets (no more, no less).
// This guards against drift when adding or removing keys.
describe('auth locale key parity', () => {
  const enKeys = Object.keys(enAuth).sort();
  const deKeys = Object.keys(deAuth).sort();
  const elKeys = Object.keys(elAuth).sort();

  it('de/auth.json has the same keys as en/auth.json', () => {
    expect(deKeys).toEqual(enKeys);
  });

  it('el/auth.json has the same keys as en/auth.json', () => {
    expect(elKeys).toEqual(enKeys);
  });

  it('all three locales contain continueWithGithub', () => {
    expect(enAuth).toHaveProperty('continueWithGithub');
    expect(deAuth).toHaveProperty('continueWithGithub');
    expect(elAuth).toHaveProperty('continueWithGithub');
  });

  it('all three locales contain githubNoVerifiedEmail', () => {
    expect(enAuth).toHaveProperty('githubNoVerifiedEmail');
    expect(deAuth).toHaveProperty('githubNoVerifiedEmail');
    expect(elAuth).toHaveProperty('githubNoVerifiedEmail');
  });

  it('all three locales contain githubOauthFailed', () => {
    expect(enAuth).toHaveProperty('githubOauthFailed');
    expect(deAuth).toHaveProperty('githubOauthFailed');
    expect(elAuth).toHaveProperty('githubOauthFailed');
  });
});
