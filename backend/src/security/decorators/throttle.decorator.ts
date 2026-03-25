/**
 * Re-export throttler decorators so the rest of the app imports from one place.
 *
 * Usage:
 *   @Throttle({ default: { ttl: 60000, limit: 5 } })   // custom limit
 *   @SkipThrottle()                                      // bypass throttler
 */
export { Throttle, SkipThrottle } from '@nestjs/throttler';
