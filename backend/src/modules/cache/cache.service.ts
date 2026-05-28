import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export const CacheKeys = {
  pet: (id: string) => `pet:${id}`,
  petList: (ownerId: string) => `pets:owner:${ownerId}`,
  vetVerification: (vetId: string) => `vet:verification:${vetId}`,
  userSession: (userId: string) => `session:${userId}`,
  userPermissions: (userId: string) => `permissions:${userId}`,
  qrScan: (petId: string) => `qr:pet:${petId}`,
};

export const CacheTTL = {
  PET_PROFILE: 300,       // 5 min — QR scan hot path
  PET_LIST: 120,          // 2 min
  VET_VERIFICATION: 600,  // 10 min
  USER_SESSION: 900,      // 15 min
  USER_PERMISSIONS: 600,  // 10 min
};

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      return (await this.cache.get<T>(key)) ?? null;
    } catch (err: any) {
      this.logger.warn(`Cache GET failed for key "${key}": ${err?.message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttlSeconds * 1000);
    } catch (err: any) {
      this.logger.warn(`Cache SET failed for key "${key}": ${err?.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (err: any) {
      this.logger.warn(`Cache DEL failed for key "${key}": ${err?.message}`);
    }
  }

  async invalidatePet(petId: string, ownerId?: string): Promise<void> {
    await this.del(CacheKeys.pet(petId));
    await this.del(CacheKeys.qrScan(petId));
    if (ownerId) await this.del(CacheKeys.petList(ownerId));
  }

  async invalidateVetVerification(vetId: string): Promise<void> {
    await this.del(CacheKeys.vetVerification(vetId));
  }

  async invalidateUserSession(userId: string): Promise<void> {
    await this.del(CacheKeys.userSession(userId));
    await this.del(CacheKeys.userPermissions(userId));
  }

  /**
   * Cache-aside helper: returns cached value or executes factory and caches result.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
