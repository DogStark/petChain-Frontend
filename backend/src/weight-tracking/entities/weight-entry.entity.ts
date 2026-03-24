import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';

export enum WeightUnit {
    KG = 'kg',
    LBS = 'lbs',
}

@Entity('weight_entries')
export class WeightEntry {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'pet_id' })
    petId: string;

    @ManyToOne(() => Pet, (pet) => pet.weightEntries, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'pet_id' })
    pet: Pet;

    @Column('decimal', { precision: 6, scale: 2 })
    weight: number;

    @Column({
        type: 'enum',
        enum: WeightUnit,
        default: WeightUnit.KG,
    })
    unit: WeightUnit;

    @Column({ type: 'date' })
    date: string;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}