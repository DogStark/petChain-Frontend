export const twoFactorUtils = {
  // Validate TOTP token format (6 digits)
  validateTOTPToken: (token: string): boolean => {
    return /^\d{6}$/.test(token);
  },

  // Validate backup code format (8 alphanumeric characters)
  validateBackupCode: (code: string): boolean => {
    return /^[A-Z0-9]{8}$/.test(code.toUpperCase());
  },

  // Format TOTP token input (remove non-digits, limit to 6 chars)
  formatTOTPToken: (input: string): string => {
    return input.replace(/\D/g, '').slice(0, 6);
  },

  // Format backup code input (uppercase, remove non-alphanumeric, limit to 8 chars)
  formatBackupCode: (input: string): string => {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  },

  // Generate QR code URL for TOTP setup
  generateQRCodeURL: (secret: string, email: string, issuer: string = 'PetChain'): string => {
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: '30'
    });
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params}`;
  }
};