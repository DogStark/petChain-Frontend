<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# PetChain Backend Service

A high-performance, robust, and secure server-side API application for the PetChain platform. Built on the [NestJS](https://github.com/nestjs/nest) framework, it uses TypeORM, PostgreSQL, Redis, Elasticsearch, and integrates with the Stellar blockchain network to manage secure, auditable pet records and digital wallets.

---

## 📂 Directory Structure

Below is an overview of the key directories and files in the backend workspace:

```
backend/
├── .kiro/                       # Feature specifications & tasks (e.g., search engine specifications)
├── app/                         # Next.js App Router API endpoints wrapper
│   └── api/search/              # Autocomplete and nearby search API endpoints
├── docs/                        # In-depth system documentation
│   ├── MIGRATION_SYSTEM.md      # Database migration system documentation
│   ├── disaster-recovery-...md  # Disaster recovery architecture & plans
│   └── disaster-recovery-...md  # Step-by-step recovery runbook
├── lib/                         # Shared libraries (e.g., Elasticsearch client configuration)
├── nginx/                       # Load balancer configurations for High Availability (HA)
├── scripts/                     # Shell scripts for backups, HA failover, and health monitoring
├── src/                         # NestJS application source code
│   ├── audit/                   # Security audit logs
│   ├── auth/                    # Core authentication system (MFA, JWT, social logins)
│   ├── behavior/                # User behavior analytics
│   ├── common/                  # Shared utilities, interceptors, and filters
│   ├── config/                  # Configuration loaders (App, DB, Stellar, CDN, Storage, etc.)
│   ├── database/                # Database migrations and seed scripts
│   ├── modules/                 # Modular business domain modules (e.g., pets, vets, zkp)
│   ├── scripts/                 # App-level scripts (e.g., breeds data seeding)
│   └── vet-verification/        # Vet registration verification routines
├── test/                        # End-to-end integration and e2e testing suites
├── Dockerfile                   # Development/Skeleton Node.js Dockerfile
├── .Dockerfile.real             # Production stage-built, resource-optimized Dockerfile
├── docker-compose.yml           # Local dev services (PostgreSQL, Redis, ClamAV, pgAdmin)
├── docker-compose.ha.yml        # High Availability local environment orchestration
├── k8s-backend.yaml             # Kubernetes deployment configurations for the backend
└── package.json                 # Node.js dependencies, scripts, and build metadata
```

---

## ⚙️ Configuration & Environment

The backend application is configured using environment variables. An example template is provided in [.env.example](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/.env.example).

Copy the example file to `.env` in the backend root directory before starting the application:
```bash
cp .env.example .env
```

### Key Configurations

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgres://user:password@localhost:5432/petchain` |
| `JWT_SECRET` | Secret key used for signing JWT access tokens | `replace-with-a-long-random-string` |
| `API_KEY_HMAC_SECRET` | HMAC secret for hashing API keys (Required for server startup) | `replace-with-a-long-random-string` |
| `REDIS_URL` | Redis server connection URL | `redis://localhost:6379` |
| `STORAGE_BUCKET` | AWS S3 / Google Cloud storage bucket name for uploads | `petchain-uploads` |

For configurations loaded into NestJS modules, check the code in [src/config/](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/src/config/).

---

## 🛠️ Development & Local Execution

### Prerequisites
- Node.js (version specified in [.nvmrc](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/.nvmrc))
- Docker and Docker Compose (optional but recommended for running external services)

### Setup & Installation
Install the project dependencies defined in [package.json](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/package.json):
```bash
npm install
```

### Start Services (PostgreSQL, Redis, ClamAV)
Use Docker Compose to run local databases and auxiliary services:
```bash
docker-compose up -d
```

### Compile & Run Application
```bash
# Development (Live Watch Mode)
npm run start:dev

# Production Build
npm run build

# Run Production Build
npm run start:prod
```

---

## 🗄️ Database Migrations & Seeding

Database migrations are managed using TypeORM. For an in-depth explanation of the migration architecture, best practices, and REST management endpoints, see the [Migration System Documentation](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/docs/MIGRATION_SYSTEM.md).

### Migration Commands
```bash
# Check migration status (pending and applied)
npm run migration:status

# Run all pending migrations
npm run migration:run

# Rollback the last applied migration
npm run migration:rollback

# Generate a new migration file based on schema diff
npm run migration:generate <migration-name>

# Validate the structural integrity of migration files
npm run migration:validate
```

### Data Seeding
To populate the database with initial lookup data (e.g., standard pet breeds):
```bash
npm run seed:breeds
```

---

## 🔄 Operational & Disaster Recovery Scripts

The backend includes a comprehensive operations suite located in [scripts/](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/). For detailed setup, failover architecture, and runbooks, refer to [README-DISASTER-RECOVERY.md](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/README-DISASTER-RECOVERY.md).

### Backup Automation
- [backup-coordinator.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/backup-coordinator.sh): Orchestrates database, configuration, and file backups.
- [backup-database.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/backup-database.sh): Automated, compressed PostgreSQL database backup and upload to AWS S3.
- [backup-files.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/backup-files.sh): Backs up user uploads and documents.
- [backup-config.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/backup-config.sh): Backs up system environment configurations and SSL certificates.
- [verify-backup.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/verify-backup.sh): Validates the integrity and availability of backup archives.

### High Availability & Failover
- [health-monitor.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/health-monitor.sh): Continuously monitors backend service nodes and database status, raising alerts via Slack or Email.
- [failover-manager.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/failover-manager.sh): Automatically detects primary node failures and promotes standby nodes to maintain uptime.

### Deployment & Recovery
- [disaster-recovery.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/disaster-recovery.sh): Core script to reconstruct the backend service, databases, and configuration from backup archives.
- [recovery-testing.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/recovery-testing.sh): Automates simulated drills of recovery procedures and failover scenarios.
- [migration-deploy.sh](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/scripts/migration-deploy.sh): Deploys migrations safely within a production CI/CD pipeline.

---

## 🧪 Testing

Testing configurations and scripts are defined in [package.json](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/backend/package.json):

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate test coverage reports
npm run test:cov

# Run end-to-end (e2e) tests
npm run test:e2e
```

---

## 📜 License & Compliance

This application is UNLICENSED / proprietary to PetChain. Security standards, GDPR conformity, and logging structures must be preserved. Review the [SECURITY.md](file:///c:/Users/USER/Documents/Codes/Stellar/petchain_frontend/SECURITY.md) at the project root for further compliance details.
