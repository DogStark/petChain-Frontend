import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { EntityFactory } from '../../../database/seeds/factories/entity.factory';
import {
  FIRST_NAMES,
  LAST_NAMES,
} from '../../../database/seeds/data/mock-data';

@Injectable()
export class UsersSeederService {
  private readonly logger = new Logger(UsersSeederService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async seedUsers(count: number = 10): Promise<User[]> {
    this.logger.log(`Seeding ${count} users...`);
    const users: User[] = [];

    for (let i = 0; i < count; i++) {
      const firstName = EntityFactory.getRandomElement(FIRST_NAMES);
      const lastName = EntityFactory.getRandomElement(LAST_NAMES);

      const user = this.userRepository.create({
        email: EntityFactory.generateEmail(firstName, lastName),
        firstName,
        lastName,
        phone: EntityFactory.generatePhone(),
        address: EntityFactory.generateAddress(),
        city: EntityFactory.getRandomElement([
          'New York',
          'Los Angeles',
          'Chicago',
        ]),
        country: 'USA',
        emailVerified: true,
        phoneVerified: true,
      });

      users.push(await this.userRepository.save(user));
    }

    this.logger.log(`Successfully seeded ${users.length} users`);
    return users;
  }
}
