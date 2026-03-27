import { registerAs } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export const databaseConfig = registerAs(
  'database',
  (): DataSourceOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'petchain',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    
    // Connection Pool Configuration
    extra: {
      // Maximum number of connections in the pool
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      // Minimum number of connections in the pool
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      // Maximum time a connection can sit idle in the pool (ms)
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      // Maximum time to wait for a connection from the pool (ms)
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '5000', 10),
      // Maximum time a query can run before being terminated (ms)
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000', 10),
      // Time to wait for a query to cancel (ms)
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
    },
    
    // Performance optimizations
    connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000', 10),
    
    // Migrations configuration
    migrations: [__dirname + '/../database/migrations/**/*{.ts,.js}'],
    migrationsTableName: 'migrations',
    
    // Query performance monitoring
    logger: process.env.DB_LOGGING === 'true' ? 'advanced-console' : undefined,
    maxQueryExecutionTime: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10),
  }),
);

// DataSource for TypeORM CLI
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'petchain',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  
  // Connection Pool Configuration
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '5000', 10),
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000', 10),
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
  },
  
  migrations: [__dirname + '/../database/migrations/**/*{.ts,.js}'],
  migrationsTableName: 'migrations',
});
