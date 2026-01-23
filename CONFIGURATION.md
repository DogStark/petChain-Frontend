# Configuration Examples

## Backend Configuration

### .env File (Backend)
```env
# Server Configuration
NODE_ENV=development
API_URL=http://localhost:3000
API_PORT=3000

# Database Configuration
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_secure_password
DB_DATABASE=petchain_db
DB_SYNCHRONIZE=false
DB_LOGGING=true
DB_MIGRATIONS_RUN=true

# File Upload Configuration
UPLOADS_DIR=./uploads/avatars
MAX_FILE_SIZE=5242880 # 5MB in bytes
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRATION=3600 # seconds (1 hour)
JWT_REFRESH_EXPIRATION=604800 # seconds (7 days)

# Email Configuration (if sending actual notifications)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@petchain.com

# Session Configuration
SESSION_EXPIRATION=604800 # 7 days in seconds
SESSION_CLEANUP_INTERVAL=86400 # Run cleanup daily

# Activity Log Configuration
ACTIVITY_LOG_RETENTION_DAYS=90
SUSPICIOUS_ACTIVITY_THRESHOLD=5 # Failed logins before flagging

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=debug
LOG_FILE=logs/app.log

# Feature Flags
ENABLE_PROFILE_COMPLETION=true
ENABLE_ACTIVITY_LOGGING=true
ENABLE_SUSPICIOUS_DETECTION=true
ENABLE_SESSION_CLEANUP=true
```

### TypeORM Configuration (ormconfig.ts)
```typescript
import { DataSourceOptions } from 'typeorm';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'petchain_db',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  maxQueryExecutionTime: 1000, // Log slow queries
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};
```

### File Upload Configuration
```typescript
// config/upload.config.ts
import { diskStorage } from 'multer';
import * as path from 'path';

export const multerConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = process.env.UPLOADS_DIR || './uploads/avatars';
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${req.user.id}-${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = (
      process.env.ALLOWED_MIME_TYPES || 
      'image/jpeg,image/png,image/webp,image/gif'
    ).split(',');

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
};
```

### CORS Configuration
```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS Configuration
  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
  
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  });

  // Serve static files
  app.useStaticAssets('uploads', {
    prefix: '/uploads',
  });

  await app.listen(process.env.API_PORT || 3000);
  console.log(`Server running on port ${process.env.API_PORT || 3000}`);
}

bootstrap();
```

---

## Frontend Configuration

### .env.local File (Frontend)
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# App Configuration
NEXT_PUBLIC_APP_NAME=PetChain
NEXT_PUBLIC_APP_VERSION=1.0.0

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=true

# Timeout Configuration
NEXT_PUBLIC_API_TIMEOUT=30000 # 30 seconds in ms
```

### .env.production (Frontend)
```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.petchain.com/api

# App Configuration
NEXT_PUBLIC_APP_NAME=PetChain
NEXT_PUBLIC_APP_VERSION=1.0.0

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=true

# Timeout Configuration
NEXT_PUBLIC_API_TIMEOUT=30000
```

### next.config.js Configuration
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '*.petchain.com',
        pathname: '/uploads/**',
      },
    ],
  },

  // Redirects
  redirects: async () => [
    {
      source: '/settings',
      destination: '/preferences',
      permanent: true,
    },
  ],

  // Headers
  headers: async () => [
    {
      source: '/api/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, must-revalidate',
        },
      ],
    },
  ],

  // Environment variables
  env: {
    API_TIMEOUT: process.env.NEXT_PUBLIC_API_TIMEOUT || 30000,
  },
};

module.exports = nextConfig;
```

### API Client Configuration
```typescript
// lib/api/apiClient.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
}

export class ApiClient {
  private api: AxiosInstance;
  private timeout: number;

  constructor(baseURL: string) {
    this.timeout = parseInt(
      process.env.NEXT_PUBLIC_API_TIMEOUT || '30000',
      10
    );

    this.api = axios.create({
      baseURL,
      timeout: this.timeout,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiErrorResponse>) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  getClient(): AxiosInstance {
    return this.api;
  }
}
```

---

## Database Configuration

### PostgreSQL Connection Pool
```javascript
// config/database.config.ts
export const databaseConfig = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  
  // Connection pool
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  },

  // Logging and monitoring
  logging: process.env.NODE_ENV === 'development',
  logger: 'advanced-console',
};
```

### Backup Configuration
```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/petchain_db_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U postgres -h localhost -d petchain_db > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 30 backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

---

## Docker Configuration

### Dockerfile (Backend)
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["npm", "run", "start"]
```

### docker-compose.yml
```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    container_name: petchain_db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_secure_password
      POSTGRES_DB: petchain_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: petchain_backend
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: postgres
      DB_PASSWORD: your_secure_password
      DB_DATABASE: petchain_db
      API_PORT: 3000
      JWT_SECRET: your_jwt_secret
      UPLOADS_DIR: /app/uploads/avatars
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend/src:/app/src
      - uploads:/app/uploads
    command: npm run start:dev

  frontend:
    build:
      context: ./
      dockerfile: Dockerfile.frontend
    container_name: petchain_frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000/api
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
  uploads:
```

---

## Testing Configuration

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

### Test Example
```typescript
// users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepository;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should create a user', async () => {
    const createUserDto = {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'password123',
    };

    mockRepository.create.mockReturnValue(createUserDto);
    mockRepository.save.mockResolvedValue({ id: '123', ...createUserDto });

    const result = await service.create(createUserDto);
    expect(result.id).toBe('123');
  });
});
```

---

## Security Configuration

### Helmet Configuration
```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### Rate Limiting
```typescript
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),
  ],
})
export class AppModule {}
```

---

This configuration file covers all major configuration areas needed for the user management system. Adjust values according to your deployment environment and security requirements.
