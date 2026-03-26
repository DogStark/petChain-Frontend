export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export class VetVerification {
  id: string;
  userId: string;

  licenseNumber: string;
  documentUrl: string;

  status: VerificationStatus;

  expiryDate: Date;

  createdAt: Date;
  updatedAt: Date;
}