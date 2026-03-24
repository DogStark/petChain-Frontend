import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Vaccination } from './vaccination.entity';

@Entity('vaccination_adverse_reactions')
export class VaccinationAdverseReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vaccination_id' })
  vaccinationId: string;

  @ManyToOne(() => Vaccination, (vaccination) => vaccination.adverseReactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vaccination_id' })
  vaccination: Vaccination;

  @Column()
  reaction: string;

  @Column({ nullable: true })
  severity: string | null;

  @Column({ type: 'timestamp', name: 'onset_at', nullable: true })
  onsetAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
