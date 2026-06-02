import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateBlockingReportingTables1701234567890 implements MigrationInterface {
  name = 'CreateBlockingReportingTables1701234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create blocks table
    await queryRunner.createTable(
      new Table({
        name: 'blocks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'blockerId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'blockedId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          new Index('IDX_blocks_blockerId', ['blockerId']),
          new Index('IDX_blocks_blockedId', ['blockedId']),
        ],
        uniques: [
          {
            name: 'UQ_blocks_blockerId_blockedId',
            columnNames: ['blockerId', 'blockedId'],
          },
        ],
      }),
      true,
    );

    // Create reports table
    await queryRunner.createTable(
      new Table({
        name: 'reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'reporterId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'targetId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'targetType',
            type: 'enum',
            enum: ['USER', 'PET', 'RECORD', 'COMMENT'],
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'enum',
            enum: ['SPAM', 'ABUSE', 'MISINFORMATION', 'OTHER'],
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'],
            default: "'PENDING'",
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          new Index('IDX_reports_reporterId', ['reporterId']),
          new Index('IDX_reports_targetId_targetType', ['targetId', 'targetType']),
          new Index('IDX_reports_status', ['status']),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reports');
    await queryRunner.dropTable('blocks');
  }
}