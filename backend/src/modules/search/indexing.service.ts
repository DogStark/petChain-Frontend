import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ReindexResult {
  indexed: number;
  failed: number;
  duration: number;
}

interface EntityConfig {
  table: string;
  noopColumn: string;
}

const ENTITY_CONFIGS: EntityConfig[] = [
  { table: 'pets', noopColumn: 'name' },
  { table: 'vets', noopColumn: '"vetName"' },
  { table: 'medical_records', noopColumn: 'diagnosis' },
];

const BATCH_SIZE = 100;

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async indexPet(petId: string): Promise<void> {
    const result = await this.dataSource.query(
      `UPDATE pets SET name = name WHERE id = $1`,
      [petId],
    );
    const affected = result[1] ?? 0;
    if (affected === 0) {
      this.logger.warn(
        `indexPet: no rows affected for petId=${petId} (entity not found)`,
      );
    }
  }

  async indexVet(vetId: string): Promise<void> {
    const result = await this.dataSource.query(
      `UPDATE vets SET "vetName" = "vetName" WHERE id = $1`,
      [vetId],
    );
    const affected = result[1] ?? 0;
    if (affected === 0) {
      this.logger.warn(
        `indexVet: no rows affected for vetId=${vetId} (entity not found)`,
      );
    }
  }

  async indexMedicalRecord(recordId: string): Promise<void> {
    const result = await this.dataSource.query(
      `UPDATE medical_records SET diagnosis = diagnosis WHERE id = $1`,
      [recordId],
    );
    const affected = result[1] ?? 0;
    if (affected === 0) {
      this.logger.warn(
        `indexMedicalRecord: no rows affected for recordId=${recordId} (entity not found)`,
      );
    }
  }

  async reindexAll(): Promise<ReindexResult> {
    const start = Date.now();
    let indexed = 0;
    let failed = 0;

    for (const entity of ENTITY_CONFIGS) {
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const queryRunner = this.dataSource.createQueryRunner();
        try {
          await queryRunner.connect();
          await queryRunner.startTransaction();

          const updateSql = `
            UPDATE ${entity.table}
            SET ${entity.noopColumn} = ${entity.noopColumn}
            WHERE id IN (
              SELECT id FROM ${entity.table}
              ORDER BY id
              LIMIT ${BATCH_SIZE} OFFSET ${offset}
            )
          `;
          const result = await queryRunner.query(updateSql);
          const rowsAffected: number = result[1] ?? 0;

          await queryRunner.commitTransaction();

          if (rowsAffected === 0) {
            hasMore = false;
          } else {
            indexed += rowsAffected;
            offset += BATCH_SIZE;
            if (rowsAffected < BATCH_SIZE) {
              hasMore = false;
            }
          }
        } catch (err) {
          try {
            await queryRunner.rollbackTransaction();
          } catch (rollbackErr) {
            this.logger.warn(
              `reindexAll: rollback failed for ${entity.table} at offset ${offset}`,
              rollbackErr,
            );
          }
          this.logger.warn(
            `reindexAll: batch failed for ${entity.table} at offset ${offset}`,
            err,
          );
          failed += BATCH_SIZE;
          offset += BATCH_SIZE;
          // Continue to next batch rather than aborting
        } finally {
          await queryRunner.release();
        }
      }
    }

    const duration = Date.now() - start;
    return { indexed, failed, duration };
  }
}
