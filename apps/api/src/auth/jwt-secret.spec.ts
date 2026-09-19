import { resolveJwtSecret } from './jwt-secret';

describe('resolveJwtSecret', () => {
  it('returns the configured secret outside production', () => {
    expect(resolveJwtSecret({ NODE_ENV: 'development', JWT_SECRET: 'x' } as NodeJS.ProcessEnv)).toBe(
      'x',
    );
  });

  it('falls back to dev-secret outside production when unset', () => {
    expect(resolveJwtSecret({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe('dev-secret');
  });

  it('accepts a strong secret in production', () => {
    const secret = 'a'.repeat(32);
    expect(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret } as NodeJS.ProcessEnv)).toBe(
      secret,
    );
  });

  it('rejects a missing secret in production', () => {
    expect(() => resolveJwtSecret({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      /JWT_SECRET is required/,
    );
  });

  it('rejects publicly known defaults in production', () => {
    for (const secret of ['dev-secret', 'change-me-in-production']) {
      expect(() =>
        resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret } as NodeJS.ProcessEnv),
      ).toThrow(/publicly known default/);
    }
  });

  it('rejects short secrets in production', () => {
    expect(() =>
      resolveJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: 'short-but-not-default',
      } as NodeJS.ProcessEnv),
    ).toThrow(/at least 32 characters/);
  });
});
