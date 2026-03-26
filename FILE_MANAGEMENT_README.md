# File Management System Module

Complete file management system for petChain medical records platform with secure storage, permissions, backup, and recovery capabilities.

## Overview

This module provides enterprise-grade file management with:
- ✅ Secure file upload and storage
- ✅ Fine-grained access control
- ✅ File backup and recovery
- ✅ Image optimization
- ✅ Sharing and collaboration
- ✅ Admin monitoring

## Installation

### 1. Install Dependencies

```bash
# Backend dependencies are already included
npm install

# Install additional optional dependencies
npm install sharp jimp  # For image processing
```

### 2. Configure Environment

Copy the configuration template and configure for your environment:

```bash
cp .env.file-management.example .env.local
# Edit .env.local with your settings
```

Key configurations:
- Storage provider (S3 or GCS)
- File size limits
- Encryption settings
- Backup retention

### 3. Database Setup

Create the new entities:

```bash
# Run migrations
npm run typeorm migration:generate src/migrations/AdminCreateFileManagement
npm run typeorm migration:run
```

Or manually create tables:

```sql
-- File permissions table
CREATE TABLE file_permissions (
  id UUID PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES file_metadata(id),
  user_id UUID REFERENCES "user"(id),
  permission_type VARCHAR NOT NULL,
  access_level VARCHAR NOT NULL,
  share_token VARCHAR UNIQUE,
  shared_by UUID NOT NULL,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  notes VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP
);

-- File backups table
CREATE TABLE file_backups (
  id UUID PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES file_metadata(id),
  backup_storage_key VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  size_bytes BIGINT,
  checksum VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  error_details VARCHAR,
  backup_type VARCHAR DEFAULT 'AUTO',
  file_metadata_snapshot JSONB,
  cloud_transaction_id VARCHAR
);

-- Create indexes
CREATE INDEX idx_file_permissions_file_user ON file_permissions(file_id, user_id);
CREATE INDEX idx_file_permissions_access_level ON file_permissions(file_id, access_level);
CREATE INDEX idx_file_backups_file_date ON file_backups(file_id, created_at);
CREATE INDEX idx_file_backups_status ON file_backups(status);
CREATE INDEX idx_file_backups_expiry ON file_backups(expires_at);
```

### 4. Redis Setup (for BullMQ)

```bash
# Install Redis (if not already installed)
docker run -d -p 6379:6379 redis:latest

# Or configure existing Redis connection
REDIS_HOST=your-redis-host
REDIS_PORT=6379
```

## Usage Examples

### Upload File

```typescript
// From the frontend/client
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('petId', petId);
formData.append('description', 'Pet photo');

const response = await fetch('/api/v1/files/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

### Share File with User

```bash
curl -X POST http://localhost:3001/api/v1/files/{fileId}/share \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-2-id",
    "permissionType": "viewer",
    "accessLevel": "private",
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

Response:
```json
{
  "id": "perm-123",
  "fileId": "file-1",
  "userId": "user-2-id",
  "permissionType": "viewer",
  "accessLevel": "private",
  "isActive": true,
  "createdAt": "2025-03-26T10:00:00Z"
}
```

### Generate Shareable Link

```bash
curl -X POST http://localhost:3001/api/v1/files/{fileId}/share-link \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "permissionType": "viewer",
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

Response:
```json
{
  "shareToken": "a1b2c3d4...",
  "fileId": "file-1",
  "permissionType": "viewer",
  "shareUrl": "http://localhost:3001/files/access/a1b2c3d4...",
  "createdAt": "2025-03-26T10:00:00Z"
}
```

### Access File via Share Link

```bash
# No authentication needed
curl http://localhost:3001/files/access/{shareToken}
```

### Create Backup

```bash
curl -X POST http://localhost:3001/api/v1/files/{fileId}/backup \
  -H "Authorization: Bearer {token}"
```

Response:
```json
{
  "id": "backup-1",
  "fileId": "file-1",
  "status": "pending",
  "createdAt": "2025-03-26T10:00:00Z",
  "expiresAt": "2025-06-24T10:00:00Z"
}
```

### Restore from Backup

```bash
curl -X POST http://localhost:3001/api/v1/files/backups/{backupId}/restore \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "replaceOriginal": true
  }'
```

### List Backups

```bash
curl http://localhost:3001/api/v1/files/{fileId}/backups?page=1&pageSize=20 \
  -H "Authorization: Bearer {token}"
```

Response:
```json
{
  "backups": [
    {
      "id": "backup-1",
      "fileId": "file-1",
      "status": "completed",
      "sizeBytes": 1024000,
      "createdAt": "2025-03-26T02:00:00Z",
      "expiresAt": "2025-06-24T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### Admin: Get System Statistics

```bash
curl http://localhost:3001/api/v1/admin/files/statistics \
  -H "Authorization: Bearer {admin-token}"
```

Response:
```json
{
  "totalFiles": 1000,
  "activeFiles": 950,
  "totalSize": 5368709120000,
  "averageSize": 5368709120,
  "filesByType": {
    "IMAGE": 600,
    "VIDEO": 200,
    "DOCUMENT": 150,
    "MEDICAL_RECORD": 40,
    "LICENSE": 10
  }
}
```

## API Reference

### File Management Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/files/:id` | ✅ | Get file metadata |
| GET | `/api/v1/files/:id/download` | ✅ | Get download URL |
| GET | `/api/v1/files/:id/versions` | ✅ | Get version history |
| DELETE | `/api/v1/files/:id` | ✅ | Delete file |

### Sharing Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/files/:id/permissions` | ✅ | List permissions |
| POST | `/api/v1/files/:id/share` | ✅ | Share with user |
| POST | `/api/v1/files/:id/share-link` | ✅ | Generate share link |
| PATCH | `/api/v1/files/:id/permissions/:permissionId` | ✅ | Update permission |
| DELETE | `/api/v1/files/:id/permissions/:permissionId` | ✅ | Revoke permission |
| GET | `/api/v1/files/shared/with-me` | ✅ | Get shared files |
| GET | `/files/access/:shareToken` | ❌ | Access via token |

### Backup Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/files/:id/backup` | ✅ | Create backup |
| GET | `/api/v1/files/:id/backups` | ✅ | List backups |
| GET | `/api/v1/files/:id/backups/:backupId` | ✅ | Get backup |
| POST | `/api/v1/files/backups/:backupId/restore` | ✅ | Restore backup |
| DELETE | `/api/v1/files/backups/:backupId` | ✅ | Delete backup |

### Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/files/statistics` | ✅🔒 | System stats |
| GET | `/api/v1/admin/files/backups/statistics` | ✅🔒 | Backup stats |
| GET | `/api/v1/admin/files/all` | ✅🔒 | List all files |
| GET | `/api/v1/admin/files/storage/by-user` | ✅🔒 | Storage by user |
| GET | `/api/v1/admin/files/storage/by-type` | ✅🔒 | Storage by type |

*Auth ✅ = Authentication required, 🔒 = Admin role required*

## Permission Model

### Permission Types
- **OWNER**: Full control, can share and delete
- **EDITOR**: Can read and update metadata
- **VIEWER**: Read-only access
- **COMMENTER**: Can read and add comments

### Access Levels
- **PRIVATE**: Owner and explicitly granted users only
- **LINK**: Accessible via secure shareable link
- **PUBLIC**: Anyone with the link can access

## Security Features

- 🔐 Encryption at rest (optional AES-256)
- 🛡️ MIME type validation with magic number verification
- 🦠 Integrated virus scanning
- ⏰ Permission expiration support
- 📝 Comprehensive audit logging
- 🔗 Signed URLs with expiration
- 👤 Role-based access control

## Monitoring

### View Backup Status
```bash
SELECT id, status, size_bytes, created_at, completed_at 
FROM file_backups 
ORDER BY created_at DESC LIMIT 10;
```

### Check Storage Usage
```bash
SELECT 
  file_type,
  COUNT(*) as count,
  SUM(size_bytes) as total_size,
  AVG(size_bytes) as avg_size
FROM file_metadata
GROUP BY file_type;
```

### View Permission Activity
```bash
SELECT user_id, count(*) 
FROM file_permissions 
WHERE last_accessed_at > NOW() - INTERVAL 7 DAY
GROUP BY user_id;
```

## Troubleshooting

### Issue: "Virus detected in file"
- Check ClamAV service is running
- Verify file doesn't contain actual malware
- Try uploading different file type

### Issue: "Permission denied" on share
- Verify you are the file owner
- Check User ID is correct
- Ensure recipient user exists in system

### Issue: Backup fails
- Check Redis connection
- Verify storage provider credentials
- Check available disk space
- Review error logs

### Issue: Restore doesn't work
- Ensure backup is in COMPLETED status
- Check backup hasn't expired
- Verify sufficient storage space
- Check original file still exists (if not replacing)

## Performance Tips

1. **Enable Image Optimization**: Automatically compress images on upload
2. **Configure Backup Retention**: Set appropriate expiration (30-90 days)
3. **Monitor Storage Usage**: Regularly check space and prune old backups
4. **Use CDN**: Serve files through CDN for faster access
5. **Enable Caching**: Cache permission checks in Redis

## Roadmap

- [ ] File versioning with diff tracking
- [ ] Collaborative comments on files
- [ ] File encryption with user-managed keys
- [ ] Bulk upload/batch operations
- [ ] File preview generation (PDF, Office)
- [ ] Advanced search with text indexing
- [ ] Mobile app support
- [ ] Webhook notifications

## Support & Feedback

For issues or suggestions, please create an issue or contact the development team.

