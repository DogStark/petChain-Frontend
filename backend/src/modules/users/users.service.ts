import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

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
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updateProfileDto: UpdateUserProfileDto,
  ): Promise<User> {
    const user = await this.findOne(userId);

    // Check if email is being changed and if it's already taken
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateProfileDto.email);
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    Object.assign(user, updateProfileDto);
    return await this.userRepository.save(user);
  }

  /**
   * Update user avatar
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<User> {
    const user = await this.findOne(userId);
    user.avatarUrl = avatarUrl;
    return await this.userRepository.save(user);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<User> {
    const user = await this.findOne(userId);
    user.lastLogin = new Date();
    return await this.userRepository.save(user);
  }

  /**
   * Get user profile with public info
   */
  async getPublicProfile(userId: string) {
    const user = await this.findOne(userId);
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }

  /**
   * Get profile completion score
   */
  getProfileCompletionScore(user: User): number {
    let score = 0;
    const fields = [
      user.firstName,
      user.lastName,
      user.email,
      user.phone,
      user.avatarUrl,
    ];

    fields.forEach((field) => {
      if (field) {
        score += 20;
      }
    });

    return score;
  }

  /**
   * Get profile completion status
   */
  async getProfileCompletion(userId: string) {
    const user = await this.findOne(userId);
    const score = this.getProfileCompletionScore(user);

    return {
      completionScore: score,
      isComplete: score === 100,
      missingFields: [
        !user.firstName ? 'firstName' : null,
        !user.lastName ? 'lastName' : null,
        !user.email ? 'email' : null,
        !user.phone ? 'phone' : null,
        !user.avatarUrl ? 'avatarUrl' : null,
      ].filter(Boolean),
    };
  }

  /**
   * Deactivate account
   */
  async deactivateAccount(userId: string): Promise<User> {
    const user = await this.findOne(userId);
    user.isDeactivated = true;
    user.isActive = false;
    return await this.userRepository.save(user);
  }

  /**
   * Reactivate account
   */
  async reactivateAccount(userId: string): Promise<User> {
    const user = await this.findOne(userId);
    user.isDeactivated = false;
    user.isActive = true;
    return await this.userRepository.save(user);
  }

  /**
   * Soft delete user (mark as deleted but keep data)
   */
  async softDeleteUser(userId: string): Promise<User> {
    const user = await this.findOne(userId);
    user.deletedAt = new Date();
    user.isActive = false;
    user.email = `deleted-${user.id}@example.com`; // Anonymize email
    return await this.userRepository.save(user);
  }

  /**
   * Hard delete user and all associated data
   */
  async hardDeleteUser(userId: string): Promise<void> {
    const user = await this.findOne(userId);
    await this.userRepository.remove(user);
  }

  /**
   * Check if user is deleted
   */
  async isUserDeleted(userId: string): Promise<boolean> {
    const user = await this.findOne(userId);
    return user.deletedAt !== null;
  }

  /**
   * Delete a user
   */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }
}
