import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Report } from './report.entity';

@Entity('report_notes')
@Index(['report'])
@Index(['admin'])
export class ReportNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Report, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: Report;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'admin_id' })
  admin: User;

  @Column({
    type: 'text',
    nullable: false,
  })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
