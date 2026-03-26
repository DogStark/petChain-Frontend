/**
 * File Status Enum
 * Tracks the lifecycle state of an uploaded file
 */
export enum FileStatus {
  /** File uploaded, awaiting validation */
  PENDING = 'PENDING',

  /** File is being validated (virus scan, etc.) */
  VALIDATING = 'VALIDATING',

  /** File is being processed (resizing, thumbnails, etc.) */
  PROCESSING = 'PROCESSING',

  /** File ready for use */
  READY = 'READY',

  /** Validation or processing failed */
  FAILED = 'FAILED',

  /** File marked for deletion (soft delete) */
  DELETED = 'DELETED',

  /** File quarantined due to security issues */
  QUARANTINED = 'QUARANTINED',
}
