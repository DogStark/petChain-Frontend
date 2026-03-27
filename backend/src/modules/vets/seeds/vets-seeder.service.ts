import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vet } from '../entities/vet.entity';
import { EntityFactory } from '../../../database/seeds/factories/entity.factory';
import { CLINIC_NAMES, SPECIALIZATIONS } from '../../../database/seeds/data/mock-data';

@Injectable()
export class VetsSeederService {
  private readonly logger = new Logger(VetsSeederService.name);

  constructor(
    @InjectRepository(Vet)
    private readonly vetRepository: Repository<Vet>,
  ) {}

  async seedVets(count: number = 5): Promise<Vet[]> {
    this.logger.log(`Seeding ${count} vets...`);
    const vets: Vet[] = [];

    for (let i = 0; i < count; i++) {
        const firstName = EntityFactory.getRandomElement(['Dr. James', 'Dr. Mary', 'Dr. Robert', 'Dr. Patricia']);
        const lastName = EntityFactory.getRandomElement(['Smith', 'Johnson', 'Williams', 'Brown']);
        
        const vet = this.vetRepository.create({
            clinicName: EntityFactory.getRandomElement(CLINIC_NAMES),
            vetName: `${firstName} ${lastName}`,
            licenseNumber: `VET-${EntityFactory.getRandomInt(10000, 99999)}`,
            email: EntityFactory.generateEmail(firstName.replace('Dr. ', ''), lastName),
            phone: EntityFactory.generatePhone(),
            address: EntityFactory.generateAddress(),
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            specializations: [EntityFactory.getRandomElement(SPECIALIZATIONS)],
            latitude: 40.7128,
            longitude: -74.0060,
        });
        
        vets.push(await this.vetRepository.save(vet));
    }

    this.logger.log(`Successfully seeded ${vets.length} vets`);
    return vets;
  }
}
