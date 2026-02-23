import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SpeciesType {
  DOG = 'dog',
  CAT = 'cat',
}

export enum SizeCategory {
  EXTRA_SMALL = 'extra_small', // <5 lbs
  SMALL = 'small',             // 5-25 lbs
  MEDIUM = 'medium',           // 26-60 lbs
  LARGE = 'large',             // 61-100 lbs
  EXTRA_LARGE = 'extra_large', // >100 lbs
}

@Entity('breeds')
@Index(['species', 'name'])
@Index(['species', 'size_category'])
export class Breed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SpeciesType,
  })
  @Index()
  species: SpeciesType;

  @Column({ length: 100 })
  @Index()
  name: string;

  @Column({
    type: 'enum',
    enum: SizeCategory,
  })
  size_category: SizeCategory;

  @Column('text', { array: true, default: [] })
  temperament: string[];

  @Column('text', { array: true, default: [] })
  common_health_issues: string[];

  @Column('json', { nullable: true })
  life_expectancy: {
    min: number;
    max: number;
    average: number;
  };

  @Column('json', { nullable: true })
  care_requirements: {
    exercise_level: 'low' | 'moderate' | 'high';
    grooming_needs: 'minimal' | 'moderate' | 'high';
    training_difficulty: 'easy' | 'moderate' | 'challenging';
    good_with_kids: boolean;
    good_with_pets: boolean;
    apartment_friendly: boolean;
  };

  @Column('json', { nullable: true })
  vaccination_schedule: {
    core_vaccines: string[];
    recommended_vaccines: string[];
    schedule_notes: string;
  };

  @Column({ nullable: true })
  image_url: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ length: 100, nullable: true })
  origin_country: string;

  @Column('json', { nullable: true })
  physical_characteristics: {
    weight_range: { min: number; max: number; unit: 'lbs' | 'kg' };
    height_range: { min: number; max: number; unit: 'inches' | 'cm' };
    coat_type: string;
    colors: string[];
  };

  @Column('json', { nullable: true })
  breed_group: {
    akc_group?: string; // For dogs
    cfa_group?: string; // For cats
    purpose: string[];
  };

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}