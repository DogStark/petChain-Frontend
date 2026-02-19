import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Parser } from 'json2csv';
import { User } from '../entities/user.entity';
import { SearchUsersDto } from '../dto/search-users.dto';

interface CursorData {
  sortVal: string;
  id: string;
}

type SortDefinition = {
  expression: string;
  getSortValue: (user: User) => string;
};

const SORT_MAP: Record<string, SortDefinition> = {
  createdAt: {
    expression: 'user.createdAt',
    getSortValue: (u) => u.createdAt.toISOString(),
  },
  firstName: {
    expression: 'LOWER(user.firstName)',
    getSortValue: (u) => (u.firstName ?? '').toLowerCase(),
  },
  lastName: {
    expression: 'LOWER(user.lastName)',
    getSortValue: (u) => (u.lastName ?? '').toLowerCase(),
  },
  name: {
    expression: `LOWER(CONCAT(user.firstName, ' ', user.lastName))`,
    getSortValue: (u) =>
      `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase().trim(),
  },
  email: {
    expression: 'LOWER(user.email)',
    getSortValue: (u) => (u.email ?? '').toLowerCase(),
  },
  lastActive: {
    expression: 'user.lastLogin',
    getSortValue: (u) => u.lastLogin?.toISOString() ?? new Date(0).toISOString(),
  },
};

@Injectable()
export class UserSearchService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async searchUsers(dto: SearchUsersDto) {
    const { q, role, status, from, to, sort = 'createdAt_desc', cursor, limit = 20 } = dto;

    const sortKey = sort.substring(0, sort.lastIndexOf('_'));
    const direction = sort.substring(sort.lastIndexOf('_') + 1).toUpperCase();
    const order: 'ASC' | 'DESC' = direction === 'ASC' ? 'ASC' : 'DESC';

    const sortDef = SORT_MAP[sortKey];
    if (!sortDef) {
      throw new BadRequestException(`Invalid sort column: ${sortKey}`);
    }

    const qb = this.userRepository.createQueryBuilder('user');

    if (q) {
      qb.andWhere(
        '(user.email ILIKE :q OR user.firstName ILIKE :q OR user.lastName ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    if (role) {
      qb.innerJoin('user.userRoles', 'userRole', 'userRole.isActive = true')
        .innerJoin('userRole.role', 'role')
        .andWhere('role.name = :roleName', { roleName: role });
    }

    this.applyStatusFilter(qb, status);

    if (from) {
      qb.andWhere('user.createdAt >= :from', { from: new Date(from) });
    }
    if (to) {
      qb.andWhere('user.createdAt <= :to', { to: new Date(to) });
    }

    qb.orderBy(sortDef.expression, order).addOrderBy('user.id', 'ASC');

    if (cursor) {
      const cursorData = this.decodeCursor(cursor);
      this.applyCursorCondition(qb, sortDef, sortKey, order, cursorData);
    }

    qb.take(limit + 1);

    const users = await qb.getMany();
    const hasMore = users.length > limit;
    if (hasMore) users.pop();

    let nextCursor: string | null = null;
    if (hasMore && users.length > 0) {
      const last = users[users.length - 1];
      nextCursor = this.encodeCursor(sortDef.getSortValue(last), last.id);
    }

    return {
      data: users.map(({ password, ...safe }) => safe),
      pagination: { nextCursor, hasMore, count: users.length },
    };
  }

  async exportUsers(dto: SearchUsersDto): Promise<string> {
    let allUsers: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    const MAX_RECORDS = 5000;

    while (hasMore && allUsers.length < MAX_RECORDS) {
      const result = await this.searchUsers({ ...dto, limit: 100, cursor });
      allUsers = allUsers.concat(result.data);
      hasMore = result.pagination.hasMore;
      cursor = result.pagination.nextCursor ?? undefined;
    }

    if (allUsers.length === 0) return '';

    const parser = new Parser({
      fields: [
        { label: 'ID', value: 'id' },
        { label: 'Email', value: 'email' },
        { label: 'First Name', value: 'firstName' },
        { label: 'Last Name', value: 'lastName' },
        { label: 'Phone', value: 'phone' },
        { label: 'Active', value: 'isActive' },
        { label: 'Deactivated', value: 'isDeactivated' },
        { label: 'Email Verified', value: 'emailVerified' },
        { label: 'Created At', value: 'createdAt' },
        { label: 'Last Login', value: 'lastLogin' },
      ],
    });

    return parser.parse(allUsers);
  }

  private applyStatusFilter(qb: SelectQueryBuilder<User>, status?: string): void {
    switch (status) {
      case 'active':
        qb.andWhere('user.isActive = true AND user.isDeactivated = false AND user.deletedAt IS NULL');
        break;
      case 'inactive':
        qb.andWhere('user.isActive = false AND user.isDeactivated = false AND user.deletedAt IS NULL');
        break;
      case 'deactivated':
        qb.andWhere('user.isDeactivated = true AND user.deletedAt IS NULL');
        break;
      case 'deleted':
        qb.andWhere('user.deletedAt IS NOT NULL');
        break;
    }
  }

  private applyCursorCondition(
    qb: SelectQueryBuilder<User>,
    sortDef: SortDefinition,
    sortKey: string,
    order: 'ASC' | 'DESC',
    cursor: CursorData,
  ): void {
    const isDateField = sortKey === 'createdAt' || sortKey === 'lastActive';
    const cv = isDateField ? new Date(cursor.sortVal) : cursor.sortVal;
    const op = order === 'ASC' ? '>' : '<';
    const expr = sortDef.expression;

    qb.andWhere(
      `(${expr} ${op} :cv OR (${expr} = :cv AND user.id > :cid))`,
      { cv, cid: cursor.id },
    );
  }

  private encodeCursor(sortVal: string, id: string): string {
    return Buffer.from(JSON.stringify({ sortVal, id })).toString('base64url');
  }

  private decodeCursor(cursor: string): CursorData {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }
}
