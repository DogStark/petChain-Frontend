import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from '../api-keys.service';

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => headers[name.toLowerCase()] ?? undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  const mockService: jest.Mocked<Pick<ApiKeysService, 'validateAndConsume'>> = {
    validateAndConsume: jest.fn(),
  };

  beforeEach(() => {
    guard = new ApiKeyGuard(mockService as unknown as ApiKeysService);
    jest.clearAllMocks();
  });

  it('throws UnauthorizedException with a descriptive message when header is missing', async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('API key required');
  });

  it('returns true when a valid key is provided', async () => {
    mockService.validateAndConsume.mockResolvedValue({ apiKey: {} as any });
    const ctx = makeContext({ 'x-api-key': 'pk_live_somekey' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('propagates exceptions from validateAndConsume', async () => {
    mockService.validateAndConsume.mockRejectedValue(
      new UnauthorizedException('Invalid API key'),
    );
    const ctx = makeContext({ 'x-api-key': 'bad_key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key');
  });
});
