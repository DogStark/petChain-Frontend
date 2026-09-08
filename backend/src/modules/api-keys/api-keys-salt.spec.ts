describe('ApiKeysService module load — API_KEY_HMAC_SECRET guard', () => {
  const originalEnv = process.env.API_KEY_HMAC_SECRET;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.API_KEY_HMAC_SECRET;
    } else {
      process.env.API_KEY_HMAC_SECRET = originalEnv;
    }
    // Purge the cached module so the next test re-evaluates the top-level check.
    jest.resetModules();
  });

  it('throws at module load time when API_KEY_HMAC_SECRET is not set', () => {
    delete process.env.API_KEY_HMAC_SECRET;
    expect(() => require('./api-keys.service')).toThrow(
      'API_KEY_HMAC_SECRET environment variable is required',
    );
  });

  it('does not throw when API_KEY_HMAC_SECRET is set', () => {
    process.env.API_KEY_HMAC_SECRET = 'a-valid-secret-value';
    expect(() => require('./api-keys.service')).not.toThrow();
  });
});
