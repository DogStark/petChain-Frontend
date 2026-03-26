# File Management System Implementation Guide

## Task #164: API File Management System

Complete implementation of a secure file management system with storage, permissions, backup, and recovery capabilities.

---

## ✅ Implemented Features

### 1. **Secure File Upload and Storage**
- ✅ File validation (MIME type, magic numbers, size limits)
- ✅ Virus scanning before storage
- ✅ Encryption at rest support
- ✅ Multi-provider support (AWS S3, Google Cloud Storage)
- ✅ Checksum verification

**Location**: `backend/src/modules/upload/upload.service.ts`

### 2. **Multiple File Type Support**
- ✅ Automatic file type detection
- ✅ Support for: Images, Videos, PDFs, Documents
- ✅ File type enums: IMAGE, VIDEO, DOCUMENT, MEDICAL_RECORD, LICENSE
- ✅ Metadata extraction per file type

**Location**: `backend/src/modules/upload/entities/file-type.enum.ts`

### 3. **File Access Control and Permissions**
- ✅ Permission-based access model (OWNER, EDITOR, VIEWER, COMMENTER)
- ✅ Access levels (PRIVATE, LINK, PUBLIC)
- ✅ Fine-grained permission management
- ✅ Permission expiration support
- ✅ Audit trail of permission changes

**Location**: 
- Entity: `backend/src/modules/files/entities/file-permission.entity.ts`
- Service: `backend/src/modules/files/services/file-permission.service.ts`

### 4. **Image Resizing and Optimization**
- ✅ Integrated with existing image processing service
- ✅ Automatic thumbnail generation
- ✅ WebP conversion support
- ✅ Metadata stripping for security
- ✅ Multiple format variants

**Location**: `backend/src/modules/processing/image-processing.service.ts`

### 5. **File Backup and Recovery**
- ✅ Scheduled daily backups (2 AM UTC)
- ✅ On-demand manual backups
- ✅ Point-in-time recovery
- ✅ Backup retention policies (90 days default)
- ✅ Automated backup cleanup

**Location**: 
- Entity: `backend/src/modules/files/entities/file-backup.entity.ts`
- Service: `backend/src/modules/files/services/file-backup.service.ts`

### 6. **Cloud Storage Integration**
- ✅ AWS S3 provider with presigned URLs
- ✅ Google Cloud Storage provider
- ✅ S3-compatible service support (MinIO)
- ✅ Unified storage interface

**Location**: `backend/src/modules/storage/`

### 7. **File Management Service**
- ✅ Complete CRUD operations
- ✅ File versioning
- ✅ Soft delete with recovery
- ✅ File metadata management
- ✅ Search and filtering

**Location**: `backend/src/modules/files/files.service.ts`

### 8. **Access Control Middleware**
- ✅ Request-level permission validation
- ✅ Share token verification
- ✅ Permission expiration checks
- ✅ Audit logging of access

**Location**: `backend/src/modules/files/middlewares/file-access.middleware.ts`

### 9. **File Sharing Endpoints**
- ✅ POST `/files/:id/share` - Share with user
- ✅ POST `/files/:id/share-link` - Generate sharable link
- ✅ GET `/files/:id/permissions` - List permissions
- ✅ PATCH `/files/:id/permissions/:permissionId` - Update permission
- ✅ DELETE `/files/:id/permissions/:permissionId` - Revoke permission
- ✅ GET `/files/shared/with-me` - Get shared files

### 10. **Backup Endpoints**
- ✅ POST `/files/:id/backup` - Create backup
- ✅ GET `/files/:id/backups` - List backups
- ✅ GET `/files/:id/backups/:backupId` - Get backup details
- ✅ POST `/files/backups/:backupId/restore` - Restore from backup
- ✅ DELETE `/files/backups/:backupId` - Delete backup

### 11. **Admin File Management**
- ✅ System file statistics
- ✅ Backup statistics and monitoring
- ✅ Storage usage by user/type
- ✅ File audit logs
- ✅ Permanent file deletion (admin override)
- ✅ Pending deletion recovery

**Location**: `backend/src/modules/files/controllers/admin-files.controller.ts`

### 12. **Job Queue Processing**
- ✅ BullMQ integration for async jobs
- ✅ Backup job processor
- ✅ Restore job processor
- ✅ Delete job processor
- ✅ Retry logic with exponential backoff

**Location**: `backend/src/modules/files/processors/file-backup.processor.ts`

### 13. **Scheduled Tasks (Cron)**
- ✅ Daily auto-backup job (2 AM UTC)
- ✅ Weekly backup cleanup job
- ✅ Expired permission cleanup

**Location**: `backend/src/modules/files/services/file-backup.service.ts`

### 14. **Testing Suite**
- ✅ Unit tests for FilePermissionService
- ✅ E2E tests for API endpoints
- ✅ Test coverage for all major operations

**Location**: 
- Unit: `backend/src/modules/files/services/file-permission.service.spec.ts`
- E2E: `backend/test/files-management.e2e-spec.ts`

---

## 📋 API Endpoints

### File Management
```
GET    /api/v1/files/:id                    # Get file metadata
GET    /api/v1/files/:id/download           # Get download URL
GET    /api/v1/files/:id/versions           # Get version history
POST   /api/v1/files/:id/revert/:version    # Revert to version
DELETE /api/v1/files/:id                    # Delete file
GET    /api/v1/files/pet/:petId             # Get files for pet
```

### File Permissions & Sharing
```
GET    /api/v1/files/:id/permissions                    # List permissions
POST   /api/v1/files/:id/share                          # Share with user
POST   /api/v1/files/:id/share-link                     # Generate share link
PATCH  /api/v1/files/:id/permissions/:permissionId      # Update permission
DELETE /api/v1/files/:id/permissions/:permissionId      # Revoke permission
GET    /api/v1/files/shared/with-me                     # Get shared files
```

### File Backup & Recovery
```
POST   /api/v1/files/:id/backup                         # Create backup
GET    /api/v1/files/:id/backups                        # List backups
GET    /api/v1/files/:id/backups/:backupId              # Get backup
POST   /api/v1/files/backups/:backupId/restore          # Restore backup
DELETE /api/v1/files/backups/:backupId                  # Delete backup
```

### Admin Operations
```
GET    /api/v1/admin/files/statistics                   # File statistics
GET    /api/v1/admin/files/backups/statistics           # Backup statistics
GET    /api/v1/admin/files/all                          # List all files
GET    /api/v1/admin/files/storage/by-user              # Storage by user
GET    /api/v1/admin/files/storage/by-type              # Storage by type
GET    /api/v1/admin/files/:id/audit                    # File audit log
DELETE /api/v1/admin/files/:id                          # Permanent delete
GET    /api/v1/admin/files/backups/cleanup              # Clean up backups
GET    /api/v1/admin/files/deleted/pending              # Pending deletions
GET    /api/v1/admin/files/:id/restore                  # Restore deleted file
```

---

## 🏗️ Architecture

### Database Schema

**FilePermission Entity**
- Manages fine-grained access control
- Supports multiple permission types
- Share tokens for link-based access
- Expiration and audit trails

**FileBackup Entity**
- Tracks all file backups
- Stores backup metadata
- Schedule tracking
- Retention policies

### Storage Design
```
backups/{userId}/{fileId}/{timestamp}/  (Backup location)
uploads/{userId}/{petId}/{filename}     (Original files)
```

### Permission Hierarchy
```
OWNER (4)     -> Full control, can delete, share
EDITOR (3)    -> Can read and modify metadata
COMMENTER (2) -> Can read and comment
VIEWER (1)    -> Read-only access
```

### Access Levels
```
PRIVATE -> Owner and granted users only
LINK    -> Accessible via shareable token
PUBLIC  -> Anyone can access
```

---

## 🔒 Security Features

1. **Encryption at Rest**
   - Optional AES-256 encryption
   - Configurable via environment

2. **Access Control**
   - Role-based permissions
   - Permission expiration
   - Audit logging

3. **Virus Scanning**
   - Pre-upload scanning
   - Threat detection

4. **MIME Type Validation**
   - Magic number verification
   - File extension checking

5. **Signed URLs**
   - Expiring download links
   - Provider-specific security

---

## 📊 Monitoring & Maintenance

### Scheduled Maintenance
- `2 AM UTC`: Daily backup creation
- `Sunday 2 AM UTC`: Weekly backup cleanup
- `Daily`: Expired permission cleanup

### Admin Dashboard
- File usage statistics
- Backup status monitoring
- Storage utilization
- User activity audit logs

---

## 🚀 Deployment Checklist

- [ ] Configure environment variables for storage provider
- [ ] Set up Redis for BullMQ
- [ ] Run database migrations for new entities
- [ ] Configure S3/GCS credentials
- [ ] Set up SMTP for notifications (optional)
- [ ] Enable backup scheduler
- [ ] Configure backup retention policies
- [ ] Set up monitoring/alerts

---

## 🧪 Testing

### Run Unit Tests
```bash
npm run test backend/src/modules/files/services/file-permission.service.spec.ts
```

### Run E2E Tests
```bash
npm run test:e2e backend/test/files-management.e2e-spec.ts
```

### Test Coverage
```bash
npm run test:cov
```

---

## 📝 Configuration

### Environment Variables
```env
# Storage
STORAGE_PROVIDER=s3 or gcs
AWS_S3_BUCKET=petchain-uploads
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# Encryption
FILE_ENCRYPTION_ENABLED=true
FILE_ENCRYPTION_KEY=xxxxx

# File Limits
MAX_FILE_SIZE_MB=50
ALLOWED_MIME_TYPES=image/jpeg,image/png,...

# Backup
BACKUP_RETENTION_DAYS=90
```

---

## 🔄 Data Flow

### File Upload Flow
```
1. User uploads file
2. File validation (MIME, magic number, size)
3. Virus scanning
4. Encryption (if enabled)
5. Storage upload
6. Metadata persistence
7. Processing queue job created
8. Image/video processing
9. Variants created
10. File ready for access
```

### Backup Flow
```
1. Backup job triggered (manual or scheduled)
2. File downloaded from storage
3. Checksum calculated
4. Uploaded to backup location
5. Backup metadata updated
6. Retention policy applied
7. Cleanup scheduled (if expired)
```

### Access Control Flow
```
1. Request received with file ID
2. User authentication verified
3. Permission check:
   - Is user owner? -> Allow
   - Has explicit permission? -> Check expiration
   - Valid share token? -> Allow
4. Access granted or denied
5. Audit log entry created
6. Last accessed time updated
```

---

## 📚 References

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [BullMQ Documentation](https://docs.bullmq.io)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3)
- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)

