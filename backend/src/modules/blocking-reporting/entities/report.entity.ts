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
import { ReportCategory } from '../enums/report-category.enum';
import { ReportStatus } from '../enums/report-status.enum';

@Entity('reports')
@Index(['reporter'])
@Index(['reportedUser'])
@Index(['status'])
@Index(['category'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'reported_user_id' })
  reportedUser: User;

  @Column({
    type: 'enum',
    enum: ReportCategory,
    nullable: false,
  })
  category: ReportCategory;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
    nullable: false,
  })
  status: ReportStatus;

  @Column({
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
