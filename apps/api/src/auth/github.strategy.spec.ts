import { ConfigService } from '@nestjs/config';
import { GithubStrategy } from './github.strategy';
import { GithubNoVerifiedEmailError, GithubOauthFailedError } from './github-oauth.errors';

// Minimal profile shape as returned by passport-github2
function makeProfile(id: string) {
  return { id, displayName: 'Test User', emails: [], photos: [] };
}

function makeConfigService(overrides: Record<string, string> = {}): ConfigService {
  return {
    getOrThrow: (key: string) => {
      const config: Record<string, string> = {
        GITHUB_CLIENT_ID: 'test-client-id',
        GITHUB_CLIENT_SECRET: 'test-client-secret',
        GITHUB_CALLBACK_URL: 'http://localhost:8888/api/auth/github/callback',
        ...overrides,
      };
      const value = config[key];
      if (!value) throw new Error(`Missing config: ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

// Build a strategy instance with a stubbed _oauth2 so no real HTTP calls run
function buildStrategy(emailsApiResponse: object[] | 'network-error'): GithubStrategy {
  const strategy = new GithubStrategy(makeConfigService());

  // Intercept the internal fetch by patching prototype used in validate()
  const originalValidate = (strategy as unknown as { validate: (...args: unknown[]) => unknown }).validate.bind(strategy);

  // Stub the protected fetch call by replacing the implementation on the instance
  // so our test controls what the emails API returns without a real HTTP client.
  (strategy as unknown as { _fetchGithubEmails: (token: string) => Promise<object[]> })._fetchGithubEmails =
    emailsApiResponse === 'network-error'
      ? () => Promise.reject(new Error('network error'))
      : () => Promise.resolve(emailsApiResponse);

  void originalValidate; // keep ts happy
  return strategy;
}

// No verified email -> GithubNoVerifiedEmailError, no UsersService call
describe('GithubStrategy.validate -- verified-email selection', () => {
  it('throws GithubNoVerifiedEmailError when no verified email exists in the fetched list', async () => {
    const strategy = buildStrategy([
      { email: 'unverified@example.com', verified: false, primary: true },
    ]);
    const done = jest.fn();
    await strategy.validate('access-token', 'refresh-token', makeProfile('gh-123'), done);
    expect(done).toHaveBeenCalledWith(expect.any(GithubNoVerifiedEmailError), undefined);
  });

  it('throws GithubNoVerifiedEmailError when the emails list is empty', async () => {
    const strategy = buildStrategy([]);
    const done = jest.fn();
    await strategy.validate('access-token', 'refresh-token', makeProfile('gh-456'), done);
    expect(done).toHaveBeenCalledWith(expect.any(GithubNoVerifiedEmailError), undefined);
  });

  it('throws GithubOauthFailedError on network error fetching verified emails', async () => {
    const strategy = buildStrategy('network-error');
    const done = jest.fn();
    await strategy.validate('access-token', 'refresh-token', makeProfile('gh-789'), done);
    expect(done).toHaveBeenCalledWith(expect.any(GithubOauthFailedError), undefined);
  });

  it('prefers the primary verified email when multiple are verified', async () => {
    const strategy = buildStrategy([
      { email: 'secondary@example.com', verified: true, primary: false },
      { email: 'primary@example.com', verified: true, primary: true },
    ]);
    const done = jest.fn();
    await strategy.validate('access-token', 'refresh-token', makeProfile('gh-999'), done);
    expect(done).toHaveBeenCalledWith(null, {
      provider: 'github',
      providerUserId: 'gh-999',
      email: 'primary@example.com',
    });
  });

  it('falls back to first verified email when none is primary', async () => {
    const strategy = buildStrategy([
      { email: 'first@example.com', verified: true, primary: false },
      { email: 'second@example.com', verified: true, primary: false },
    ]);
    const done = jest.fn();
    await strategy.validate('access-token', 'refresh-token', makeProfile('gh-111'), done);
    expect(done).toHaveBeenCalledWith(null, {
      provider: 'github',
      providerUserId: 'gh-111',
      email: 'first@example.com',
    });
  });
});
