import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { MedicalRecord } from './medical-record.entity';

@Entity('medical_record_versions')
export class RecordVersion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    recordId: string;

    @ManyToOne(() => MedicalRecord)
    @JoinColumn({ name: 'recordId' })
    record: MedicalRecord;

    @Column({ type: 'int' })
    version: number;

    @Column({ type: 'jsonb' })
    snapshot: Record<string, any>;

    @Column({ type: 'uuid', nullable: true })
    changedBy: string;

    @Column({ type: 'text', nullable: true })
    changeReason: string;

    @CreateDateColumn()
    changedAt: Date;
}
