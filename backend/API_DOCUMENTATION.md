# Medical Record Management System - API Documentation

## Overview
Complete medical record management system with templates, reminders, vet integration, and HIPAA-compliant data handling.

## Features
- ✅ Medical record templates by pet type
- ✅ Vaccination tracking with reminder system
- ✅ Treatment history with photos/documents
- ✅ Prescription management (active/expired tracking)
- ✅ Allergy and condition tracking
- ✅ Vet visit scheduling integration
- ✅ Medical record sharing with QR codes
- ✅ HIPAA-compliant data handling (audit logs, encryption, access control)

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation
```bash
npm install
```

### Environment Variables
Create a `.env` file with the following:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=petchain

# Application
APP_PORT=3000
APP_URL=http://localhost:3000

# Security
ENCRYPTION_KEY=your-32-character-encryption-key-here!!
```

### Running the Application
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Endpoints

### Pets
```
POST   /pets                    - Create a new pet
GET    /pets                    - List all pets (filter by ownerId)
GET    /pets/:id                - Get pet details
PATCH  /pets/:id                - Update pet
DELETE /pets/:id                - Delete pet
```

### Vets
```
POST   /vets                    - Create vet profile
GET    /vets                    - List vets (with search)
GET    /vets/:id                - Get vet details
PATCH  /vets/:id                - Update vet
DELETE /vets/:id                - Delete vet
```

### Medical Records
```
POST   /medical-records         - Create medical record (with file upload)
GET    /medical-records         - List records (filter by petId, recordType, dates)
GET    /medical-records/:id     - Get record details
GET    /medical-records/:id/qr  - Get/generate QR code for sharing
GET    /medical-records/templates/:petType - Get templates by pet type
PATCH  /medical-records/:id     - Update record
DELETE /medical-records/:id     - Soft delete record

# Export (PDF, CSV, FHIR; batch; includes attachments)
GET    /medical-records/export  - Export by query (format, petId, recordIds, dates)
POST   /medical-records/export - Export by body (format, recordIds or petId + filters)
POST   /medical-records/export/email - Export and send by email (body: format, to?, recordIds or petId, etc.)
```

### Vaccinations
```
POST   /vaccinations            - Create vaccination record
GET    /vaccinations            - List vaccinations (filter by petId)
GET    /vaccinations/reminders  - Get upcoming reminders (next 30 days)
GET    /vaccinations/overdue    - Get overdue vaccinations
GET    /vaccinations/:id        - Get vaccination details
PATCH  /vaccinations/:id        - Update vaccination
DELETE /vaccinations/:id        - Delete vaccination
```

### Allergies
```
POST   /allergies               - Create allergy record
GET    /allergies               - List allergies (filter by petId)
GET    /allergies/pet/:petId    - Get all allergies for a pet
GET    /allergies/:id           - Get allergy details
PATCH  /allergies/:id           - Update allergy
DELETE /allergies/:id           - Delete allergy
```

### Prescriptions
```
POST   /prescriptions           - Create prescription
GET    /prescriptions           - List prescriptions (filter by petId)
GET    /prescriptions/pet/:petId/active   - Get active prescriptions
GET    /prescriptions/pet/:petId/expired  - Get expired prescriptions
GET    /prescriptions/:id       - Get prescription details
PATCH  /prescriptions/:id       - Update prescription
DELETE /prescriptions/:id       - Delete prescription
```

### Appointments
```
POST   /appointments            - Schedule appointment
GET    /appointments            - List appointments (filter by petId, vetId, status)
GET    /appointments/upcoming   - Get upcoming appointments
GET    /appointments/:id        - Get appointment details
PATCH  /appointments/:id        - Update appointment
DELETE /appointments/:id        - Delete appointment
```

## Example Usage

### Create a Pet
```bash
curl -X POST http://localhost:3000/pets \
  -H "Content-Type: application/json" \
  -d '{
    "ownerId": "user-uuid",
    "name": "Max",
    "species": "dog",
    "breed": "Golden Retriever",
    "dateOfBirth": "2020-05-15",
    "gender": "male",
    "weight": 30.5
  }'
```

### Create Medical Record with File Upload
```bash
curl -X POST http://localhost:3000/medical-records \
  -F "petId=pet-uuid" \
  -F "vetId=vet-uuid" \
  -F "recordType=checkup" \
  -F "date=2026-01-22" \
  -F "diagnosis=Routine checkup - healthy" \
  -F "treatment=Vaccinations updated" \
  -F "files=@/path/to/xray.jpg" \
  -F "files=@/path/to/bloodwork.pdf"
```

### Get Vaccination Reminders
```bash
curl http://localhost:3000/vaccinations/reminders?days=30
```

### Get Active Prescriptions
```bash
curl http://localhost:3000/prescriptions/pet/{petId}/active
```

### Generate QR Code for Medical Record
```bash
curl http://localhost:3000/medical-records/{recordId}/qr
```

### Export Medical Records
Export supports **PDF**, **CSV**, and **FHIR** (R4 Bundle) formats. All exports can include attachment metadata and support **batch export** by pet or by record IDs. Optionally, the export can be **emailed**.

**GET export** (query params – use for single pet or small filters):
```bash
# PDF for a pet (batch)
curl -o records.pdf "http://localhost:3000/medical-records/export?format=pdf&petId=PET_UUID"

# CSV with date range
curl -o records.csv "http://localhost:3000/medical-records/export?format=csv&petId=PET_UUID&startDate=2024-01-01&endDate=2024-12-31"

# FHIR JSON for specific records
curl -o records.json "http://localhost:3000/medical-records/export?format=fhir&recordIds=ID1,ID2"
```

**POST export** (body – use for many record IDs or full options):
```bash
curl -X POST http://localhost:3000/medical-records/export \
  -H "Content-Type: application/json" \
  -d '{"format":"pdf","recordIds":["uuid1","uuid2"],"includeAttachments":true}' \
  -o records.pdf
```

**Email export** (requires MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS in .env):
```bash
curl -X POST http://localhost:3000/medical-records/export/email \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","petId":"PET_UUID","to":"user@example.com","message":"Your records are attached."}'
```

## Database Schema

### Tables Created
- `pets` - Pet information
- `vets` - Veterinarian profiles
- `medical_records` - Medical records with soft delete
- `record_templates` - Templates by pet type
- `vaccinations` - Vaccination records with reminders
- `allergies` - Allergy tracking
- `prescriptions` - Prescription management
- `appointments` - Appointment scheduling
- `audit_logs` - HIPAA compliance audit trail

## Security Features

### Audit Logging
All medical record operations are automatically logged with:
- User ID
- Action (create, read, update, delete)
- Entity type and ID
- IP address and user agent
- Timestamp

### Data Encryption
Sensitive data can be encrypted using the `EncryptionService`:
```typescript
import { EncryptionService } from './common/services/encryption.service';

// Encrypt
const encrypted = encryptionService.encrypt('sensitive data');

// Decrypt
const decrypted = encryptionService.decrypt(encrypted);
```

### Access Control
The `AccessControlGuard` ensures users can only access their own pets' medical records.

## HIPAA Compliance
See [HIPAA_COMPLIANCE.md](./HIPAA_COMPLIANCE.md) for detailed compliance information.

## Development

### Running Tests
```bash
npm run test
npm run test:e2e
```

### Linting
```bash
npm run lint
```

### Database Migrations
TypeORM will automatically sync the schema in development. For production:
```bash
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
```

## File Storage
Medical record attachments are currently stored locally. For production, configure cloud storage:
- AWS S3
- Google Cloud Storage
- Azure Blob Storage

Update the `saveAttachment` method in `MedicalRecordsService` to upload to your chosen provider.

## Support
For issues or questions, please refer to the documentation or contact the development team.
