import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { RedisService } from '../../auth/services/redis.service';
import { SmsService } from '../sms/sms.service';

const OTP_TTL_SECONDS = 600; // 10 minutes
const RATE_LIMIT_TTL_SECONDS = 900; // 15 minutes
const MAX_OTP_SENDS = 3;
const MAX_OTP_ATTEMPTS = 5;

export type SafeUserProfile = Omit<
  User,
  | 'password'
  | 'emailVerificationToken'
  | 'emailVerificationExpires'
  | 'phoneVerificationCode'
  | 'phoneVerificationExpires'
  | 'passwordResetToken'
  | 'passwordResetTokenExpiresAt'
  | 'passwordChangedAt'
  | 'getActiveRoles'
  | 'getProfileCompletionScore'
> & { isVerified: boolean };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
    private readonly smsService: SmsService,
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
    // Optimized: Use QueryBuilder with explicit column selection
    return await this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Get a single user by ID
   */
  async findOne(id: string): Promise<User> {
    // Optimized: Use QueryBuilder
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Get a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    // Optimized: Use QueryBuilder with indexed column
    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();
  }

  /**
   * Update a user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return await this.userRepository.save(user);
  }

  sanitizeUser(user: User): SafeUserProfile {
    const {
      password,
      emailVerificationToken,
      emailVerificationExpires,
      phoneVerificationCode,
      phoneVerificationExpires,
      passwordResetToken,
      passwordResetTokenExpiresAt,
      passwordChangedAt,
      getActiveRoles,
      getProfileCompletionScore,
      ...safeUser
    } = user as User & {
      getActiveRoles: unknown;
      getProfileCompletionScore: unknown;
    };

    return {
      ...safeUser,
      isVerified: user.isVerified,
    };
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

    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      user.emailVerified = false;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
    }

    if (updateProfileDto.phone && updateProfileDto.phone !== user.phone) {
      user.phoneVerified = false;
      user.phoneVerificationCode = null;
      user.phoneVerificationExpires = null;
    }

    // if dateOfBirth provided as string, convert to Date object
    if (updateProfileDto.dateOfBirth) {
      // allow either Date or string
      user.dateOfBirth = new Date(updateProfileDto.dateOfBirth as any);
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
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }

  /**
   * Get profile completion score
   */
  getProfileCompletionScore(user: User): number {
    // Use entity helper if available
    if (typeof user.getProfileCompletionScore === 'function') {
      return user.getProfileCompletionScore();
    }

    let score = 0;
    const fields = [
      user.firstName,
      user.lastName,
      user.email,
      user.phone,
      user.avatarUrl,
      user.dateOfBirth,
      user.address,
      user.city,
      user.country,
    ];

    const increment = Math.floor(100 / fields.length);
    fields.forEach((field) => {
      if (field) {
        score += increment;
      }
    });

    return Math.min(score, 100);
  }

  /**
   * Get profile completion status
   */
  async getProfileCompletion(userId: string) {
    const user = await this.findOne(userId);
    const score = this.getProfileCompletionScore(user);

    const missing = [];
    if (!user.firstName) missing.push('firstName');
    if (!user.lastName) missing.push('lastName');
    if (!user.email) missing.push('email');
    if (!user.phone) missing.push('phone');
    if (!user.avatarUrl) missing.push('avatarUrl');
    if (!user.dateOfBirth) missing.push('dateOfBirth');
    if (!user.address) missing.push('address');
    if (!user.city) missing.push('city');
    if (!user.country) missing.push('country');

    return {
      completionScore: score,
      isComplete: score === 100,
      missingFields: missing,
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

  // ─── Phone OTP ────────────────────────────────────────────────────────────────

  async sendPhoneOtp(userId: string, phone: string): Promise<void> {
    const rateLimitKey = `phone_otp_rate:${userId}`;
    const countRaw = await this.redisService.get(rateLimitKey);
    const count = countRaw ? parseInt(countRaw, 10) : 0;

    if (count >= MAX_OTP_SENDS) {
      throw new ForbiddenException('Too many OTP requests. Try again in 15 minutes.');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const hash = crypto.createHash('sha256').update(otp).digest('hex');

    await this.redisService.set(`phone_otp:${userId}`, hash, OTP_TTL_SECONDS);
    await this.redisService.set(rateLimitKey, String(count + 1), RATE_LIMIT_TTL_SECONDS);

    const user = await this.findOne(userId);
    await this.userRepository.save({ ...user, phone });

    await this.smsService.sendSms(
      userId,
      phone,
      `Your PetChain verification code is: ${otp}. It expires in 10 minutes.`,
    );
  }

  async verifyPhoneOtp(userId: string, otp: string): Promise<void> {
    const lockKey = `phone_otp_lock:${userId}`;
    const isLocked = await this.redisService.exists(lockKey);
    if (isLocked) {
      throw new ForbiddenException('Account locked due to too many failed OTP attempts.');
    }

    const storedHash = await this.redisService.get(`phone_otp:${userId}`);
    if (!storedHash) {
      throw new BadRequestException('OTP expired or not found. Please request a new one.');
    }

    const submittedHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Timing-safe comparison
    const stored = Buffer.from(storedHash, 'hex');
    const submitted = Buffer.from(submittedHash, 'hex');
    const match =
      stored.length === submitted.length &&
      crypto.timingSafeEqual(stored, submitted);

    if (!match) {
      const attemptsKey = `phone_otp_attempts:${userId}`;
      const attemptsRaw = await this.redisService.get(attemptsKey);
      const attempts = attemptsRaw ? parseInt(attemptsRaw, 10) : 0;

      if (attempts + 1 >= MAX_OTP_ATTEMPTS) {
        await this.redisService.set(lockKey, '1', OTP_TTL_SECONDS);
        await this.redisService.del(`phone_otp:${userId}`);
        throw new ForbiddenException('Too many failed attempts. Account locked for 10 minutes.');
      }

      await this.redisService.set(attemptsKey, String(attempts + 1), OTP_TTL_SECONDS);
      throw new BadRequestException('Invalid OTP.');
    }

    await this.redisService.del(`phone_otp:${userId}`);
    await this.redisService.del(`phone_otp_attempts:${userId}`);

    const user = await this.findOne(userId);
    await this.userRepository.save({ ...user, phoneVerified: true });
  }
}
