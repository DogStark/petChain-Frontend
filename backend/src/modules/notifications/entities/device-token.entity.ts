import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('device_tokens')
@Index(['userId'])
@Index(['token'], { unique: true })
export class DeviceToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    userId: string;

    @Column({ type: 'varchar', unique: true })
    token: string;

    @Column({ type: 'varchar', nullable: true })
    platform: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
