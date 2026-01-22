# Scalable File Upload System

## Overview

The file upload system provides a robust, scalable solution for handling user uploads, image processing, and secure storage in PetChain. It supports multi-cloud storage (AWS S3, Google Cloud Storage), automated image optimization, virus scanning hooks, and generic file management.

## Architecture

The system is built on a modular architecture:

- **Upload Module**: Handles incoming multipart requests, validation, and orchestration.
- **Storage Module**: Abstracted storage layer using the Strategy pattern to switch between providers (S3, GCS, Local).
- **Processing Module**: Powered by `sharp`, handles resizing, compression, EXIF stripping, and watermarking.
- **Security Module**: Provides virus scanning interfaces and at-rest encryption.

## Configuration

Configure the system via `.env` variables:

### Storage Provider

```env
# Options: 's3', 'gcs', 'local'
STORAGE_PROVIDER=s3
```

### AWS S3 Configuration

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=petchain-uploads
```

### Google Cloud Storage Configuration

```env
GCS_PROJECT_ID=your-project-id
GCS_BUCKET=petchain-uploads
# Optional: Path to service account key file
GCS_KEY_FILE_PATH=/path/to/key.json
```

### Processing Limits

```env
# Max file size in MB
MAX_FILE_SIZE_MB=50
# Enable encryption at rest
ENABLE_FILE_ENCRYPTION=false
```

## API Reference

### 1. Upload File

**Endpoint**: `POST /api/v1/uploads`
**Content-Type**: `multipart/form-data`

**Body**:

- `file`: The file binary (Required)
- `petId`: UUID (Optional) - Associate file with a pet
- `description`: String (Optional)
- `tags`: String[] (Optional)

**Response**:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "originalFilename": "my-dog.jpg",
  "mimeType": "image/jpeg",
  "status": "READY",
  "sizeBytes": 102400,
  "message": "File uploaded successfully"
}
```

### 2. Get File Details

**Endpoint**: `GET /api/v1/files/:id`

**Response**:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "originalFilename": "my-dog.jpg",
  "variants": [
    {
      "variantType": "THUMBNAIL",
      "width": 150,
      "height": 150,
      "format": "jpeg"
    }
  ],
  "downloadUrl": "https://..." // Signed URL if private
}
```

### 3. Get Download URL

**Endpoint**: `GET /api/v1/files/:id/download`
**Query Params**:

- `variant`: `thumbnail` | `original` (default)

**Response**:

```json
{
  "url": "https://s3.amazonaws.com/...",
  "expiresAt": "2026-01-22T12:00:00Z"
}
```

### 4. Delete File

**Endpoint**: `DELETE /api/v1/files/:id`

**Response**: `204 No Content`

## Integration Guide

To associate a file with another entity (e.g., User Profile):

1. **Frontend**: Upload file to `/api/v1/uploads`.
2. **Frontend**: Receive `fileId` from response.
3. **Frontend**: Send `fileId` when creating/updating the entity (e.g., `POST /api/users { profilePictureId: "..." }`).
4. **Backend**: Store the `fileId` in your entity.
