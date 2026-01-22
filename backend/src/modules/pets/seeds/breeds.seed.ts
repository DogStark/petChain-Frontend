import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Breed } from '../entities/breed.entity';
import { BREEDS_DATA } from '../constants/breeds-data';

@Injectable()
export class BreedsSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(Breed)
    private readonly breedRepository: Repository<Breed>,
  ) {}

  async onModuleInit() {
    // Check if breeds exist
    const count = await this.breedRepository.count();
    if (count === 0) {
      await this.seed();
    }
  }

  async seed(): Promise<void> {
    console.log('Seeding breeds...');
    for (const breedData of BREEDS_DATA) {
      const breed = this.breedRepository.create(breedData);
      await this.breedRepository.save(breed);
    }
    console.log('Breeds seeded successfully!');
  }
}
