import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileMetadata } from '../upload/entities/file-metadata.entity';
import { FileVariant } from '../upload/entities/file-variant.entity';
import { FileVersion } from '../upload/entities/file-version.entity';
import { CdnModule } from '../cdn/cdn.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileMetadata, FileVariant, FileVersion]),
    CdnModule,
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
