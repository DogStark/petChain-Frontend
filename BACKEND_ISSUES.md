# PetChain Backend Issues

### Authentication & Authorization
1. **[Auth] Setup NestJS Authentication Module with JWT**
   - Implement login and registration logic generating secure JWT tokens for session management.
2. **[Auth] Implement Role-Based Access Control (RBAC)**
   - Create Guards to differentiate available routes for `Owner`, `Vet`, and `Admin` roles.
3. **[Auth] Create Vet Verification Endpoint (License Check)**
   - Backend logic to securely upload and manually/automatically verify a veterinarian's licensing credentials.
4. **[Auth] Implement OAuth2 Login for Google/Apple**
   - Provide seamless SSO options for pet owners using Passport.js.
5. **[Auth] Add Rate Limiting to Auth Endpoints**
   - Protect login and password reset routes from brute-force attacks using ThrottlerModule.

### Database & Entities
6. **[DB] Define Pet Entity and TypeORM Migration**
   - Create the relational model for Pets including dynamic fields, breed, DoB, and owner relation.
7. **[DB] Define Medical Record Entity with Encryption fields**
   - Setup TypeORM entity for medical records, ensuring the payload column is encrypted at rest.
8. **[DB] Define User Entity (Owner & Vet)**
   - Separate attributes for general users vs veterinary institutions.
9. **[DB] Setup Redis Caching for Pet Profiles**
   - Use Redis to cache the public profiles accessed frequently via collar scanning to lower DB load.
10. **[DB] Implement Database Seeders**
    - Create a seeder script for local development to populate standard breeds, roles, and dummy pets.

### Stellar Blockchain Integration
11. **[Web3] Setup Stellar SDK Service in NestJS**
    - Create an injectable service to connect with the Stellar network (testnet/mainnet).
12. **[Web3] Anchor Medical Record Hash on Stellar**
    - Endpoint logic to take a SHA-256 hash of a medical record update and publish it via a Stellar transaction.
13. **[Web3] Retry Mechanism for Failed Stellar Transactions**
    - Implement a queue (e.g., BullMQ) to retry submitting hashes to Stellar if network conditions fail.
14. **[Web3] Stellar Wallet Generation for New Users**
    - Automatically provision a custodial Stellar keypair for users upon registration for future on-chain actions.
15. **[Web3] Verify Tamper-Proof Records**
    - Endpoint that takes a medical record ID, recalculates its hash, and verifies it against the timestamped hash on Stellar.

### Medical Records & Logic
16. **[API] CRUD Endpoints for Pet Medical Records**
    - Standard Create, Read, Update, Delete endpoints for authorized vet/owners.
17. **[API] Vaccination Reminder Cron Job Logic**
    - A daily scheduled task (`@Cron`) evaluating due dates for vaccines and queuing reminders.
18. **[API] Vet Append-Only Medical Record Feature**
    - Allow vets to add new immutably tracked records to a pet's history without allowing deletion of past edits.
19. **[API] Access Revocation for Shared Records**
    - Endpoint allowing pet owners to revoke a vet's access to their pet's data.
20. **[API] Public Scannable Pet Tag Data Endpoint**
    - High-performance, read-only endpoint that returns non-sensitive pet info when a tag is scanned.

### Notifications & Emails
21. **[Notify] Setup Email Service (AWS SES / SendGrid)**
    - Configured service to send outbound transactional emails.
22. **[Notify] Push Notification Service Integration**
    - Setup Firebase Cloud Messaging (FCM) or APNs for pushing reminders to mobile clients.
23. **[Notify] HTML Email Templates**
    - Design and integrate dynamic templates for "Upcoming Vaccinations" and "Password Resets".
24. **[Notify] Log Notification Delivery Status**
    - Persist the status of reminders (Sent, Failed, Read) to prevent spamming users.

### Security & Cryptography
25. **[Security] Implement ZKP Verification Service**
    - Integrate Zero-Knowledge Proof libraries to allow proving vaccination status without revealing underlying medical history.
26. **[Security] Encrypt Sensitive Off-Chain Data at Rest**
    - Write TypeORM subscribers/transformers to encrypt sensitive notes before inserting to PostgreSQL.
27. **[Security] Setup Helmet and Standard Security Headers**
    - Enforce Strict-Transport-Security, XSS filters, and secure CORS configurations.
28. **[Security] Class-Validator Request Validation**
    - Rigorously define DTOs to sanitize and validate all incoming request bodies.

### Offline & Sync
29. **[Sync] Delta Sync Endpoint for Mobile Offline Mode**
    - Endpoint returning only records modified since a provided `lastSyncTimestamp`.
30. **[Sync] Conflict Resolution for Concurrent Updates**
    - Logic to handle instances where offline edits clash with server-side modifications (e.g., using version vectors).

### DevOps & Observability
31. **[Ops] Setup Winston Logger / Pino**
    - Implement structured JSON logging for all API requests and errors.
32. **[Ops] Add Health Check Endpoint**
    - Configure `@nestjs/terminus` for Docker swarm/Kubernetes readiness and liveness probes.
33. **[Ops] Instrument NestJS with OpenTelemetry**
    - Export traces to Prometheus/Grafana to map out bottlenecks in blockchain/DB interactions.
34. **[Ops] GitHub Actions Workflow for Backend CI**
    - Pipeline config to run lint, build, and tests on every PR.
35. **[Ops] Automate TypeORM Migrations in CI/CD**
    - Integrate safe database migrations execution into the deployment pipeline.

### Testing
36. **[Test] E2E Tests for the Pet Tag Scanning Flow**
    - Supertest implementation simulating a tag scan and ensuring correct public data and cache hits occur.
37. **[Test] Unit Tests for Stellar Transaction Service**
    - Mock testing the Stellar SDK integration to assure network failures are handled without actually broadcasting to the chain.
