import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Breed } from '../entities/breed.entity';
import { breedSeedData } from './breed-seed-data';

@Injectable()
export class BreedsSeederService {
  private readonly logger = new Logger(BreedsSeederService.name);

  constructor(
    @InjectRepository(Breed)
    private readonly breedRepository: Repository<Breed>,
  ) {}

  /**
   * Seed the database with initial breed data
   */
  async seedBreeds(): Promise<void> {
    try {
      this.logger.log('Starting breed seeding process...');

      // Check if breeds already exist
      const existingBreedsCount = await this.breedRepository.count();
      
      if (existingBreedsCount > 0) {
        this.logger.log(`Database already contains ${existingBreedsCount} breeds. Skipping seed.`);
        return;
      }

      // Create and save breeds
      let dogCount = 0;
      let catCount = 0;
      
      for (const breedData of breedSeedData) {
        const breed = this.breedRepository.create(breedData as any);
        await this.breedRepository.save(breed);
        
        if (breedData.species === 'dog') dogCount++;
        if (breedData.species === 'cat') catCount++;
      }

      this.logger.log(`Successfully seeded ${breedSeedData.length} breeds into the database`);
      
      // Log statistics
      
      this.logger.log(`Seeded breeds: ${dogCount} dogs, ${catCount} cats`);

    } catch (error) {
      this.logger.error('Failed to seed breeds:', error);
      throw error;
    }
  }

  /**
   * Clear all breed data (use with caution)
   */
  async clearBreeds(): Promise<void> {
    try {
      this.logger.log('Clearing all breed data...');
      await this.breedRepository.delete({});
      this.logger.log('Successfully cleared all breed data');
    } catch (error) {
      this.logger.error('Failed to clear breeds:', error);
      throw error;
    }
  }

  /**
   * Re-seed the database (clear and seed)
   */
  async reseedBreeds(): Promise<void> {
    await this.clearBreeds();
    await this.seedBreeds();
  }
}