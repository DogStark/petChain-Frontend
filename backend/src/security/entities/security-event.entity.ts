import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SecurityEventType {
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DDOS_ATTACK = 'DDOS_ATTACK',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  PATH_TRAVERSAL_ATTEMPT = 'PATH_TRAVERSAL_ATTEMPT',
}

export enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('security_events')
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: SecurityEventType })
  @Index()
  type: SecurityEventType;

  @Column({ type: 'enum', enum: SecuritySeverity })
  severity: SecuritySeverity;

  @Column()
  @Index()
  ipAddress: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb' })
  metadata: {
    endpoint?: string;
    method?: string;
    userAgent?: string;
    payload?: any;
    headers?: any;
    threatScore?: number;
  };

  @Column({ default: false })
  blocked: boolean;

  @Column({ default: false })
  resolved: boolean;

  @CreateDateColumn()
  @Index()
  timestamp: Date;
}
