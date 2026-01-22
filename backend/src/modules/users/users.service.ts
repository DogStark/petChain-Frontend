import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { Parser } from 'json2csv';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(createUserDto);
    return await this.userRepository.save(user);
  }

  /**
   * Get all users
   */
  async findAll(): Promise<User[]> {
    return await this.userRepository.find();
  }

  /**
   * Get a single user by ID
   */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Get a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  /**
   * Update a user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return await this.userRepository.save(user);
  }

  /**
   * Delete a user
   */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  /**
   * Search users with filters, sorting, and cursor pagination
   */
  async searchUsers(dto: SearchUsersDto) {
    const {
      q,
      role,
      status,
      from,
      to,
      sort = 'createdAt_desc',
      cursor,
      limit = 20,
    } = dto;

    const qb = this.userRepository.createQueryBuilder('user');

    // Full-text search across multiple fields
    if (q) {
      qb.andWhere(
        new Brackets((qb) => {
          qb.where('user.email ILIKE :q', { q: `%${q}%` })
            .orWhere('user.firstName ILIKE :q', { q: `%${q}%` })
            .orWhere('user.lastName ILIKE :q', { q: `%${q}%` });
        }),
      );
    }

    // Filter by role
    if (role) {
      qb.andWhere('user.role = :role', { role });
    }

    // Filter by activity status
    if (status === 'active') {
      qb.andWhere('user.isActive = :isActive', { isActive: true });
    } else if (status === 'inactive') {
      qb.andWhere('user.isActive = :isActive', { isActive: false });
    }
    // If status is 'all' or undefined, don't filter

    // Registration date range
    if (from) {
      qb.andWhere('user.createdAt >= :from', { from: new Date(from) });
    }

    if (to) {
      qb.andWhere('user.createdAt <= :to', { to: new Date(to) });
    }

    // Sorting with validation
    const [column, order] = sort.split('_');
    const allowedColumns = ['createdAt', 'firstName', 'lastName', 'email', 'lastActive'];
    
    if (!allowedColumns.includes(column)) {
      throw new BadRequestException(`Invalid sort column: ${column}`);
    }

    qb.addOrderBy(
      `user.${column}`,
      order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
    );
    
    // Always add ID as tiebreaker for consistent cursor pagination
    qb.addOrderBy('user.id', 'ASC');

    // Cursor-based pagination
    if (cursor) {
      qb.andWhere('user.id > :cursor', { cursor });
    }

    // Fetch limit + 1 to check if there are more results
    qb.take(limit + 1);

    const users = await qb.getMany();

    // Determine if there are more results
    const hasMore = users.length > limit;
    let nextCursor: string | null = null;

    if (hasMore) {
      users.pop(); // Remove the extra item
      nextCursor = users[users.length - 1]?.id || null;
    }

    // Remove sensitive data
    const sanitizedUsers = users.map((user) => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    return {
      data: sanitizedUsers,
      pagination: {
        nextCursor,
        hasMore,
        count: sanitizedUsers.length,
      },
    };
  }

  /**
   * Export search results to CSV
   */
  async exportUsers(dto: SearchUsersDto): Promise<string> {
    // Fetch all matching users (with reasonable limit)
    let allUsers: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;
    const batchSize = 100;
    const maxRecords = 5000; // Safety limit

    while (hasMore && allUsers.length < maxRecords) {
      const result = await this.searchUsers({
        ...dto,
        limit: batchSize,
        cursor,
      });

      allUsers = allUsers.concat(result.data);
      hasMore = result.pagination.hasMore;
      cursor = result.pagination.nextCursor || undefined;
    }

    if (allUsers.length === 0) {
      return ''; // or throw error
    }

    const parser = new Parser({
      fields: [
        { label: 'ID', value: 'id' },
        { label: 'Email', value: 'email' },
        { label: 'First Name', value: 'firstName' },
        { label: 'Last Name', value: 'lastName' },
        { label: 'Role', value: 'role' },
        { label: 'Active', value: 'isActive' },
        { label: 'Created At', value: 'createdAt' },
        { label: 'Last Active', value: 'lastActive' },
      ],
    });

    return parser.parse(allUsers);
  }

  /**
   * Helper method to get search result highlights
   * (Optional - for better UX)
   */
  private getHighlights(user: User, query: string): string[] {
    const highlights: string[] = [];
    const searchTerm = query.toLowerCase();

    if (user.email?.toLowerCase().includes(searchTerm)) {
      highlights.push('email');
    }
    if (user.firstName?.toLowerCase().includes(searchTerm)) {
      highlights.push('firstName');
    }
    if (user.lastName?.toLowerCase().includes(searchTerm)) {
      highlights.push('lastName');
    }

    return highlights;
  }
}
