import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('search_analytics')
@Index(['query'])
@Index(['createdAt'])
export class SearchAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  query: string;

  @Column()
  searchType: string; // pets, vets, medical-records, emergency-services, global

  @Column({ type: 'int', default: 0 })
  resultsCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  responseTime: number; // in milliseconds

  @Column({ type: 'jsonb', nullable: true })
  filters: Record<string, any>;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ default: false })
  wasSuccessful: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
