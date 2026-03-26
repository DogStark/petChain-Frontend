import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MigrationService } from './migration.service';
import { DataSource } from 'typeorm';
import { MigrationController } from './migration.controller';

describe('MigrationService', () => {
  let service: MigrationService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockDataSource: jest.Mocked<DataSource> & { isInitialized?: boolean };

  const mockDatabaseConfig = {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'test',
    password: 'test',
    database: 'test_db',
    entities: ['**/*.entity{.ts,.js}'],
    migrations: ['**/migrations/**/*{.ts,.js}'],
    synchronize: false,
    logging: false,
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockDataSource = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: false,
      destroy: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
    } as any;

    // Set isInitialized as writable property
    Object.defineProperty(mockDataSource, 'isInitialized', {
      value: false,
      writable: true,
      configurable: true
    });

    mockConfigService.get.mockReturnValue(mockDatabaseConfig);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MigrationService>(MigrationService);
    
    service['dataSource'] = mockDataSource;
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize data source when not initialized', async () => {
      service['dataSource'] = null as any;
      
      await service.onModuleInit();
      
      expect(mockDataSource.initialize).toHaveBeenCalled();
    });

    it('should not initialize data source when already initialized', async () => {
      service['dataSource'] = mockDataSource;
      Object.defineProperty(mockDataSource, 'isInitialized', {
        value: true,
        writable: true,
        configurable: true
      });
      
      await service.onModuleInit();
      
      expect(mockDataSource.initialize).not.toHaveBeenCalled();
    });

    it('should throw error when database config is not found', async () => {
      mockConfigService.get.mockReturnValue(null);
      service['dataSource'] = null as any;
      
      await expect(service.onModuleInit()).rejects.toThrow('Database configuration not found');
    });
  });

  describe('generateMigration', () => {
    it('should generate migration file with correct format', async () => {
      const migrationName = 'test-migration';
      const fs = require('fs/promises');
      jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      
      const result = await service.generateMigration(migrationName);
      
      expect(result).toContain('test-migration');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${migrationName}.ts`),
        expect.stringContaining('implements MigrationInterface'),
        'utf-8'
      );
    });

    it('should convert migration name to PascalCase for class name', async () => {
      const migrationName = 'test-migration_name';
      const fs = require('fs/promises');
      jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      
      await service.generateMigration(migrationName);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('TestMigrationName'),
        'utf-8'
      );
    });
  });

  describe('validateMigrations', () => {
    it('should validate migration files successfully', async () => {
      const fs = require('fs/promises');
      jest.spyOn(fs, 'readdir').mockResolvedValue(['123-test.ts']);
      jest.spyOn(fs, 'readFile').mockResolvedValue(`
        import { MigrationInterface, QueryRunner } from 'typeorm';
        
        export class Test123 implements MigrationInterface {
          public async up(queryRunner: QueryRunner): Promise<void> {}
          public async down(queryRunner: QueryRunner): Promise<void> {}
        }
      `);
      
      const result = await service.validateMigrations();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing MigrationInterface', async () => {
      const fs = require('fs/promises');
      jest.spyOn(fs, 'readdir').mockResolvedValue(['123-test.ts']);
      jest.spyOn(fs, 'readFile').mockResolvedValue(`
        export class Test123 {
          public async up(queryRunner: QueryRunner): Promise<void> {}
          public async down(queryRunner: QueryRunner): Promise<void> {}
        }
      `);
      
      const result = await service.validateMigrations();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Migration 123-test.ts does not implement MigrationInterface');
    });

    it('should detect missing up method', async () => {
      const fs = require('fs/promises');
      jest.spyOn(fs, 'readdir').mockResolvedValue(['123-test.ts']);
      jest.spyOn(fs, 'readFile').mockResolvedValue(`
        import { MigrationInterface, QueryRunner } from 'typeorm';
        
        export class Test123 implements MigrationInterface {
          public async down(queryRunner: QueryRunner): Promise<void> {}
        }
      `);
      
      const result = await service.validateMigrations();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Migration 123-test.ts missing up() method');
    });

    it('should detect missing down method', async () => {
      const fs = require('fs/promises');
      jest.spyOn(fs, 'readdir').mockResolvedValue(['123-test.ts']);
      jest.spyOn(fs, 'readFile').mockResolvedValue(`
        import { MigrationInterface, QueryRunner } from 'typeorm';
        
        export class Test123 implements MigrationInterface {
          public async up(queryRunner: QueryRunner): Promise<void> {}
        }
      `);
      
      const result = await service.validateMigrations();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Migration 123-test.ts missing down() method');
    });
  });

  describe('toPascalCase', () => {
    it('should convert snake_case to PascalCase', () => {
      const result = service['toPascalCase']('test_migration_name');
      expect(result).toBe('TestMigrationName');
    });

    it('should convert kebab-case to PascalCase', () => {
      const result = service['toPascalCase']('test-migration-name');
      expect(result).toBe('TestMigrationName');
    });

    it('should handle mixed case', () => {
      const result = service['toPascalCase']('test-Migration_name');
      expect(result).toBe('TestMigrationName');
    });

    it('should handle single word', () => {
      const result = service['toPascalCase']('test');
      expect(result).toBe('Test');
    });
  });
});

describe('MigrationController', () => {
  let controller: MigrationController;
  let mockMigrationService: jest.Mocked<MigrationService>;

  beforeEach(async () => {
    mockMigrationService = {
      getMigrationStatus: jest.fn(),
      runMigrations: jest.fn(),
      rollbackLastMigration: jest.fn(),
      rollbackToVersion: jest.fn(),
      generateMigration: jest.fn(),
      validateMigrations: jest.fn(),
    } as any;

    controller = new MigrationController(mockMigrationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return migration status', async () => {
      const mockStatus = {
        pending: ['migration1'],
        executed: ['migration2'],
        totalPending: 1,
        totalExecuted: 1,
      };
      
      mockMigrationService.getMigrationStatus.mockResolvedValue(mockStatus);
      
      const result = await controller.getStatus();
      
      expect(result).toEqual(mockStatus);
      expect(mockMigrationService.getMigrationStatus).toHaveBeenCalled();
    });
  });

  describe('runMigrations', () => {
    it('should run migrations with transaction by default', async () => {
      const mockResults = [
        { success: true, migration: 'migration1', duration: 100 },
      ];
      
      mockMigrationService.runMigrations.mockResolvedValue(mockResults);
      
      const result = await controller.runMigrations();
      
      expect(result).toEqual(mockResults);
      expect(mockMigrationService.runMigrations).toHaveBeenCalledWith({ transaction: true });
    });

    it('should run migrations without transaction when specified', async () => {
      const mockResults = [
        { success: true, migration: 'migration1', duration: 100 },
      ];
      
      mockMigrationService.runMigrations.mockResolvedValue(mockResults);
      
      const result = await controller.runMigrations('false');
      
      expect(result).toEqual(mockResults);
      expect(mockMigrationService.runMigrations).toHaveBeenCalledWith({ transaction: false });
    });
  });

  describe('rollbackLast', () => {
    it('should rollback last migration', async () => {
      const mockResult = {
        success: true,
        rolledBack: ['migration1'],
        duration: 50,
      };
      
      mockMigrationService.rollbackLastMigration.mockResolvedValue(mockResult);
      
      const result = await controller.rollbackLast();
      
      expect(result).toEqual(mockResult);
      expect(mockMigrationService.rollbackLastMigration).toHaveBeenCalled();
    });
  });

  describe('rollbackToVersion', () => {
    it('should rollback to specific version', async () => {
      const mockResult = {
        success: true,
        rolledBack: ['migration2', 'migration1'],
        duration: 100,
      };
      
      mockMigrationService.rollbackToVersion.mockResolvedValue(mockResult);
      
      const result = await controller.rollbackToVersion('target-version');
      
      expect(result).toEqual(mockResult);
      expect(mockMigrationService.rollbackToVersion).toHaveBeenCalledWith('target-version');
    });
  });

  describe('generateMigration', () => {
    it('should generate migration with valid name', async () => {
      const mockResult = { filePath: '/path/to/migration.ts' };
      
      mockMigrationService.generateMigration.mockResolvedValue(mockResult.filePath);
      
      const result = await controller.generateMigration('test-migration');
      
      expect(result).toEqual(mockResult);
      expect(mockMigrationService.generateMigration).toHaveBeenCalledWith('test-migration');
    });

    it('should throw error for empty name', async () => {
      await expect(controller.generateMigration('')).rejects.toThrow('Migration name is required');
      await expect(controller.generateMigration('   ')).rejects.toThrow('Migration name is required');
    });
  });

  describe('validateMigrations', () => {
    it('should validate migrations', async () => {
      const mockResult = { valid: true, errors: [] };
      
      mockMigrationService.validateMigrations.mockResolvedValue(mockResult);
      
      const result = await controller.validateMigrations();
      
      expect(result).toEqual(mockResult);
      expect(mockMigrationService.validateMigrations).toHaveBeenCalled();
    });
  });
});
