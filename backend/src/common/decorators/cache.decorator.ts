import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cache';
export const CACHE_TTL_KEY = 'cache_ttl';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
}

export const CacheResponse = (options: CacheOptions = {}) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY, true)(target, propertyKey, descriptor);
    if (options.ttl) {
      SetMetadata(CACHE_TTL_KEY, options.ttl)(target, propertyKey, descriptor);
    }
    return descriptor;
  };
};
