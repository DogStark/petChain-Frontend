import { Logger } from '@nestjs/common';

const logger = new Logger('PerformanceMonitor');

export function MeasurePerformance(threshold: number = 1000) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;

        if (duration > threshold) {
          logger.warn(
            `Slow method: ${target.constructor.name}.${propertyKey} took ${duration}ms`,
          );
        } else {
          logger.debug(
            `${target.constructor.name}.${propertyKey} took ${duration}ms`,
          );
        }

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error(
          `Method ${target.constructor.name}.${propertyKey} failed after ${duration}ms`,
          error,
        );
        throw error;
      }
    };

    return descriptor;
  };
}
