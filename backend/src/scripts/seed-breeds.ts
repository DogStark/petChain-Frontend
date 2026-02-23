import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BreedsSeederService } from '../modules/breeds/seeds/breeds-seeder.service';

async function runSeeder() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const breedSeeder = app.get(BreedsSeederService);

  try {
    console.log('🌱 Starting breed database seeding...');
    await breedSeeder.seedBreeds();
    console.log('✅ Breed seeding completed successfully!');
  } catch (error) {
    console.error('❌ Breed seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run if called directly
if (require.main === module) {
  runSeeder();
}