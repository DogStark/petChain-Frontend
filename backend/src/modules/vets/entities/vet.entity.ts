import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vets')
export class Vet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinicName: string;

  @Column()
  vetName: string;

  @Column({ unique: true })
  licenseNumber: string;

  @Column()
  email: string;

  @Column()
  phone: string;

  @Column()
  address: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column()
  zipCode: string;

  @Column({ type: 'simple-array', nullable: true })
  specializations: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
