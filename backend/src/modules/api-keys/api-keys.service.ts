import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import { randomBytes, createHash } from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

export interface CreateApiKeyOptions {
  userId: string;
  label: string;
  expiresAt?: Date | null;
  rateLimitWindowSec?: number;
  rateLimitMax?: number;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async createKey(
    opts: CreateApiKeyOptions,
  ): Promise<{ apiKey: ApiKey; plaintextKey: string }> {
    const prefix = 'pk_live';
    const raw = randomBytes(24).toString('base64url');
    const plaintextKey = `${prefix}_${raw}`;
    const keyHash = this.hashKey(plaintextKey);
    const lastFour = plaintextKey.slice(-4);

    const entity = this.apiKeyRepository.create({
      userId: opts.userId,
      label: opts.label,
      prefix,
      lastFour,
      keyHash,
      rateLimitWindowSec: opts.rateLimitWindowSec ?? 60,
      rateLimitMax: opts.rateLimitMax ?? 60,
      expiresAt: opts.expiresAt ?? null,
      usageCount: '0',
      lastUsedAt: null,
    });

    const apiKey = await this.apiKeyRepository.save(entity);
    return { apiKey, plaintextKey };
  }

  async revokeKey(id: string, requestedByUserId: string): Promise<ApiKey> {
    const key = await this.apiKeyRepository.findOne({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');

    if (key.userId !== requestedByUserId) {
      // Allow admins at controller layer; here we only enforce by default
      throw new ForbiddenException('Not allowed to revoke this API key');
    }

    if (key.revokedAt) return key;
    key.revokedAt = new Date();
    key.revokedByUserId = requestedByUserId;
    return await this.apiKeyRepository.save(key);
  }

  async adminRevokeKey(id: string, adminUserId: string): Promise<ApiKey> {
    const key = await this.apiKeyRepository.findOne({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.revokedAt) return key;
    key.revokedAt = new Date();
    key.revokedByUserId = adminUserId;
    return await this.apiKeyRepository.save(key);
  }

  async listMyKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async validateAndConsume(plaintextKey: string): Promise<{ apiKey: ApiKey }> {
    if (!plaintextKey) throw new BadRequestException('Missing API key');
    const keyHash = this.hashKey(plaintextKey);
    const apiKey = await this.apiKeyRepository.findOne({ where: { keyHash } });
    if (!apiKey) throw new ForbiddenException('Invalid API key');
    if (apiKey.revokedAt) throw new ForbiddenException('API key revoked');
    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
      throw new ForbiddenException('API key expired');
    }

    await this.enforceRateLimit(apiKey);

    const currentCount = BigInt(apiKey.usageCount || '0');
    apiKey.usageCount = (currentCount + 1n).toString();
    apiKey.lastUsedAt = new Date();
    await this.apiKeyRepository.save(apiKey);

    return { apiKey };
  }

  private hashKey(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
  }

  private async enforceRateLimit(apiKey: ApiKey): Promise<void> {
    const windowMs = (apiKey.rateLimitWindowSec || 60) * 1000;
    const max = apiKey.rateLimitMax || 60;
    const cacheKey = `api_rate:${apiKey.id}`;
    const current = (await this.cacheManager.get<number>(cacheKey)) || 0;
    if (current >= max) {
      throw new ForbiddenException('Rate limit exceeded for API key');
    }
    await this.cacheManager.set(cacheKey, current + 1, windowMs);
  }
}
