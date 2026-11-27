import authConfig from './auth.config';

describe('authConfig', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;

    expect(() => authConfig()).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is too short', () => {
    process.env.JWT_SECRET = 'short-secret';

    expect(() => authConfig()).toThrow(/at least 32 characters/);
  });

  it('throws when JWT_SECRET has insufficient entropy', () => {
    process.env.JWT_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    expect(() => authConfig()).toThrow(/entropy/);
  });

  it('returns the configured secret when valid', () => {
    const secret = 'a-strong-and-unique-jwt-secret-value-1234567890';
    process.env.JWT_SECRET = secret;

    expect(authConfig().jwtSecret).toBe(secret);
  });
});
