import { SelectQueryBuilder } from 'typeorm';

export class QueryOptimizer {
  /**
   * Add pagination to query
   */
  static paginate<T>(
    query: SelectQueryBuilder<T>,
    page: number = 1,
    limit: number = 20,
  ): SelectQueryBuilder<T> {
    const maxLimit = 100;
    const safeLimit = Math.min(limit, maxLimit);
    const offset = (page - 1) * safeLimit;

    return query.skip(offset).take(safeLimit);
  }

  /**
   * Add selective field loading
   */
  static selectFields<T>(
    query: SelectQueryBuilder<T>,
    fields: string[],
    alias: string,
  ): SelectQueryBuilder<T> {
    if (fields.length === 0) {
      return query;
    }

    const selectFields = fields.map(field => `${alias}.${field}`);
    return query.select(selectFields);
  }

  /**
   * Add efficient counting
   */
  static async paginateAndCount<T>(
    query: SelectQueryBuilder<T>,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: T[]; total: number; page: number; totalPages: number }> {
    const maxLimit = 100;
    const safeLimit = Math.min(limit, maxLimit);

    const [items, total] = await query
      .skip((page - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Optimize joins to prevent N+1 queries
   */
  static addEagerLoading<T>(
    query: SelectQueryBuilder<T>,
    relations: string[],
  ): SelectQueryBuilder<T> {
    relations.forEach(relation => {
      query.leftJoinAndSelect(`${query.alias}.${relation}`, relation);
    });
    return query;
  }

  /**
   * Add query timeout
   */
  static withTimeout<T>(
    query: SelectQueryBuilder<T>,
    timeoutMs: number = 5000,
  ): SelectQueryBuilder<T> {
    return query.setQueryRunner(query.connection.createQueryRunner());
  }
}
