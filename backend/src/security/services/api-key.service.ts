import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomBytes } from 'crypto';
import { ApiKey } from '../entities/api-key.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from '../dto/api-key.dto';

const API_KEY_HMAC_SECRET = process.env.API_KEY_HMAC_SECRET || 'change-me-in-production';

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  reason?: string;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly KEY_PREFIX = 'pk_';

  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
  ) {}

  /** Generate a new API key and return the plaintext (shown once) */
  async create(
    dto: CreateApiKeyDto,
    ownerId?: string,
  ): Promise<{ apiKey: ApiKey; plaintext: string }> {
    const plaintext = this.KEY_PREFIX + randomBytes(32).toString('hex');
    const keyHash = this.hash(plaintext);

    const apiKey = this.apiKeyRepository.create({
      ...dto,
      keyHash,
      ownerId,
      scopes: dto.scopes ?? [],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    await this.apiKeyRepository.save(apiKey);
    this.logger.log(`API key created: ${apiKey.id} (${apiKey.name})`);

    return { apiKey, plaintext };
  }

  /** Validate an incoming raw API key */
  async validate(
    rawKey: string,
    clientIp?: string,
  ): Promise<ApiKeyValidationResult> {
    if (!rawKey?.startsWith(this.KEY_PREFIX)) {
      return { valid: false, reason: 'Invalid key format' };
    }

    const keyHash = this.hash(rawKey);
    const apiKey = await this.apiKeyRepository.findOne({ where: { keyHash } });

    if (!apiKey) return { valid: false, reason: 'Key not found' };
    if (!apiKey.isActive) return { valid: false, reason: 'Key is inactive' };
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, reason: 'Key has expired' };
    }

    // IP whitelist check
    if (apiKey.ipWhitelist && clientIp) {
      const allowed = apiKey.ipWhitelist.split(',').map((ip) => ip.trim());
      if (!allowed.includes(clientIp)) {
        return { valid: false, reason: 'IP not whitelisted' };
      }
    }

    // Update usage stats (fire-and-forget)
    void this.apiKeyRepository
      .createQueryBuilder()
      .update(ApiKey)
      .set({ lastUsedAt: new Date(), requestCount: () => 'request_count + 1' })
      .where('id = :id', { id: apiKey.id })
      .execute()
      .catch(() => {});

    return { valid: true, apiKey };
  }

  async findAll(ownerId?: string): Promise<ApiKey[]> {
    const where = ownerId ? { ownerId } : {};
    return this.apiKeyRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ApiKey> {
    const key = await this.apiKeyRepository.findOne({ where: { id } });
    if (!key) throw new NotFoundException(`API key ${id} not found`);
    return key;
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<ApiKey> {
    const key = await this.findOne(id);
    Object.assign(key, dto);
    if (dto.expiresAt) key.expiresAt = new Date(dto.expiresAt);
    return this.apiKeyRepository.save(key);
  }

  async revoke(id: string): Promise<void> {
    const key = await this.findOne(id);
    key.isActive = false;
    await this.apiKeyRepository.save(key);
    this.logger.log(`API key revoked: ${id}`);
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.apiKeyRepository.delete(id);
  }

  private hash(value: string): string {
    return createHmac('sha256', API_KEY_HMAC_SECRET).update(value).digest('hex');
  }
}
