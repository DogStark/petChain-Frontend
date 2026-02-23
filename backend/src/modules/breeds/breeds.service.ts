import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ILike, In, Not } from 'typeorm';
import { Breed, SpeciesType } from './entities/breed.entity';
import { CreateBreedDto } from './dto/create-breed.dto';
import { UpdateBreedDto } from './dto/update-breed.dto';
import { SearchBreedsDto } from './dto/search-breeds.dto';

@Injectable()
export class BreedsService {
  constructor(
    @InjectRepository(Breed)
    private readonly breedRepository: Repository<Breed>,
  ) {}

  /**
   * Create a new breed
   */
  async create(createBreedDto: CreateBreedDto): Promise<Breed> {
    // Check if breed with same name and species already exists
    const existingBreed = await this.breedRepository.findOne({
      where: {
        name: createBreedDto.name,
        species: createBreedDto.species,
      },
    });

    if (existingBreed) {
      throw new BadRequestException(
        `Breed with name '${createBreedDto.name}' already exists for ${createBreedDto.species}s`,
      );
    }

    const breed = this.breedRepository.create(createBreedDto);
    return await this.breedRepository.save(breed);
  }

  /**
   * Get all breeds with pagination and filtering
   */
  async findAll(searchDto: SearchBreedsDto): Promise<{
    data: Breed[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      search,
      species,
      size_category,
      temperament,
      origin_country,
      akc_group,
      cfa_group,
      exercise_level,
      grooming_needs,
      good_with_kids,
      good_with_pets,
      apartment_friendly,
      min_life_expectancy,
      max_life_expectancy,
      page = 1,
      limit = 20,
      sort_by = 'name',
      sort_order = 'ASC',
    } = searchDto;

    const queryBuilder: SelectQueryBuilder<Breed> = this.breedRepository
      .createQueryBuilder('breed')
      .where('breed.is_active = :isActive', { isActive: true });

    // Text search
    if (search) {
      queryBuilder.andWhere(
        '(breed.name ILIKE :search OR breed.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Species filter
    if (species) {
      queryBuilder.andWhere('breed.species = :species', { species });
    }

    // Size category filter
    if (size_category) {
      queryBuilder.andWhere('breed.size_category = :size_category', {
        size_category,
      });
    }

    // Temperament filter
    if (temperament && temperament.length > 0) {
      queryBuilder.andWhere('breed.temperament && :temperament', {
        temperament,
      });
    }

    // Origin country filter
    if (origin_country) {
      queryBuilder.andWhere('breed.origin_country = :origin_country', {
        origin_country,
      });
    }

    // Breed group filters
    if (akc_group) {
      queryBuilder.andWhere('breed.breed_group ->> \'akc_group\' = :akc_group', {
        akc_group,
      });
    }

    if (cfa_group) {
      queryBuilder.andWhere('breed.breed_group ->> \'cfa_group\' = :cfa_group', {
        cfa_group,
      });
    }

    // Care requirements filters
    if (exercise_level) {
      queryBuilder.andWhere(
        'breed.care_requirements ->> \'exercise_level\' = :exercise_level',
        { exercise_level },
      );
    }

    if (grooming_needs) {
      queryBuilder.andWhere(
        'breed.care_requirements ->> \'grooming_needs\' = :grooming_needs',
        { grooming_needs },
      );
    }

    if (good_with_kids !== undefined) {
      queryBuilder.andWhere(
        'breed.care_requirements ->> \'good_with_kids\' = :good_with_kids',
        { good_with_kids: good_with_kids.toString() },
      );
    }

    if (good_with_pets !== undefined) {
      queryBuilder.andWhere(
        'breed.care_requirements ->> \'good_with_pets\' = :good_with_pets',
        { good_with_pets: good_with_pets.toString() },
      );
    }

    if (apartment_friendly !== undefined) {
      queryBuilder.andWhere(
        'breed.care_requirements ->> \'apartment_friendly\' = :apartment_friendly',
        { apartment_friendly: apartment_friendly.toString() },
      );
    }

    // Life expectancy filters
    if (min_life_expectancy) {
      queryBuilder.andWhere(
        'CAST(breed.life_expectancy ->> \'average\' AS INTEGER) >= :min_life_expectancy',
        { min_life_expectancy },
      );
    }

    if (max_life_expectancy) {
      queryBuilder.andWhere(
        'CAST(breed.life_expectancy ->> \'average\' AS INTEGER) <= :max_life_expectancy',
        { max_life_expectancy },
      );
    }

    // Sorting
    const validSortColumns = ['name', 'species', 'size_category', 'created_at'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'name';
    queryBuilder.orderBy(`breed.${sortColumn}`, sort_order);

    // Pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get breed by ID
   */
  async findOne(id: string): Promise<Breed> {
    const breed = await this.breedRepository.findOne({
      where: { id, is_active: true },
    });

    if (!breed) {
      throw new NotFoundException(`Breed with ID '${id}' not found`);
    }

    return breed;
  }

  /**
   * Get breeds by species
   */
  async findBySpecies(species: SpeciesType): Promise<Breed[]> {
    return await this.breedRepository.find({
      where: { species, is_active: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Search breeds by name
   */
  async searchByName(name: string): Promise<Breed[]> {
    return await this.breedRepository.find({
      where: {
        name: ILike(`%${name}%`),
        is_active: true,
      },
      order: { name: 'ASC' },
      take: 10,
    });
  }

  /**
   * Get popular breeds (most searched/viewed)
   */
  async getPopularBreeds(species?: SpeciesType, limit: number = 10): Promise<Breed[]> {
    const queryBuilder = this.breedRepository
      .createQueryBuilder('breed')
      .where('breed.is_active = :isActive', { isActive: true });

    if (species) {
      queryBuilder.andWhere('breed.species = :species', { species });
    }

    // For now, return breeds by creation date
    // In future, this could be based on view counts or ratings
    return await queryBuilder
      .orderBy('breed.created_at', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Update breed
   */
  async update(id: string, updateBreedDto: UpdateBreedDto): Promise<Breed> {
    const breed = await this.findOne(id);

    // If name or species is being changed, check for duplicates
    if (updateBreedDto.name || updateBreedDto.species) {
      const name = updateBreedDto.name || breed.name;
      const species = updateBreedDto.species || breed.species;

      const existingBreed = await this.breedRepository.findOne({
        where: {
          name,
          species,
          id: Not(id),
        },
      });

      if (existingBreed) {
        throw new BadRequestException(
          `Breed with name '${name}' already exists for ${species}s`,
        );
      }
    }

    Object.assign(breed, updateBreedDto);
    return await this.breedRepository.save(breed);
  }

  /**
   * Soft delete breed (mark as inactive)
   */
  async remove(id: string): Promise<void> {
    const breed = await this.findOne(id);
    breed.is_active = false;
    await this.breedRepository.save(breed);
  }

  /**
   * Get breed statistics
   */
  async getStatistics(): Promise<{
    total: number;
    dogs: number;
    cats: number;
    by_size: Record<string, number>;
    by_country: Record<string, number>;
  }> {
    const [total, dogs, cats] = await Promise.all([
      this.breedRepository.count({ where: { is_active: true } }),
      this.breedRepository.count({ 
        where: { species: SpeciesType.DOG, is_active: true } 
      }),
      this.breedRepository.count({ 
        where: { species: SpeciesType.CAT, is_active: true } 
      }),
    ]);

    // Size distribution
    const sizeStats = await this.breedRepository
      .createQueryBuilder('breed')
      .select('breed.size_category', 'size_category')
      .addSelect('COUNT(*)', 'count')
      .where('breed.is_active = true')
      .groupBy('breed.size_category')
      .getRawMany();

    const by_size = sizeStats.reduce((acc, stat) => {
      acc[stat.size_category] = parseInt(stat.count);
      return acc;
    }, {});

    // Country distribution
    const countryStats = await this.breedRepository
      .createQueryBuilder('breed')
      .select('breed.origin_country', 'origin_country')
      .addSelect('COUNT(*)', 'count')
      .where('breed.is_active = true')
      .andWhere('breed.origin_country IS NOT NULL')
      .groupBy('breed.origin_country')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const by_country = countryStats.reduce((acc, stat) => {
      acc[stat.origin_country] = parseInt(stat.count);
      return acc;
    }, {});

    return {
      total,
      dogs,
      cats,
      by_size,
      by_country,
    };
  }
}