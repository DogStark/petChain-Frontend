import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class ApiKeysTable1742900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'api_keys',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'key_hash', type: 'varchar', isUnique: true },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'owner_id', type: 'uuid', isNullable: true },
          { name: 'scopes', type: 'text', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'expires_at', type: 'timestamptz', isNullable: true },
          { name: 'request_count', type: 'int', default: 0 },
          { name: 'last_used_at', type: 'timestamptz', isNullable: true },
          { name: 'ip_whitelist', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'api_keys',
      new TableIndex({
        columnNames: ['key_hash'],
        name: 'IDX_api_keys_key_hash',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('api_keys');
  }
}
