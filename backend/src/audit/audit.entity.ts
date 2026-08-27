import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  entity: string;

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: 'json', nullable: true })
  oldData: any;

  @Column({ type: 'json', nullable: true })
  newData: any;

  @Column()
  userId: string;

  @Column()
  hash: string;

  @CreateDateColumn()
  createdAt: Date;
}
