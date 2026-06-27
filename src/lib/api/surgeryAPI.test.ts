import { surgeryAPI } from './surgeryAPI';

describe('surgeryAPI auth handling', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('throws a clear error when authToken is missing', async () => {
    expect.hasAssertions();

    await expect(surgeryAPI.findAll()).rejects.toThrow(
      'Authentication required. Please log in to continue.'
    );
  });

  it('throws a clear error when authToken is null string', async () => {
    localStorage.setItem('authToken', 'null');
    expect.hasAssertions();

    await expect(surgeryAPI.findAll()).rejects.toThrow(
      'Authentication required. Please log in to continue.'
    );
  });
});
