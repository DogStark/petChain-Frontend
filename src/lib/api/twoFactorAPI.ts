const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface TwoFactorSetupResponse {
  qrCodeUrl: string;
  secret: string;
  backupCodes: string[];
}

export interface TwoFactorStatusResponse {
  isEnabled: boolean;
  backupCodesCount: number;
}

export const twoFactorAPI = {
  // Get 2FA status
  getStatus: async (token: string): Promise<TwoFactorStatusResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get 2FA status');
    }

    return response.json();
  },

  // Setup 2FA - generates QR code and backup codes
  setup: async (token: string): Promise<TwoFactorSetupResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/setup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to setup 2FA');
    }

    return response.json();
  },

  // Enable 2FA after verifying TOTP token
  enable: async (token: string, totpToken: string): Promise<{ backupCodes: string[] }> => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/enable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: totpToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to enable 2FA');
    }

    return response.json();
  },

  // Disable 2FA
  disable: async (token: string, totpToken: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/disable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: totpToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to disable 2FA');
    }
  },

  // Verify 2FA token during login
  verify: async (email: string, password: string, totpToken: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, token: totpToken }),
    });

    if (!response.ok) {
      throw new Error('Invalid 2FA token');
    }

    return response.json();
  },

  // Generate new backup codes
  generateBackupCodes: async (token: string): Promise<{ backupCodes: string[] }> => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/backup-codes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to generate backup codes');
    }

    return response.json();
  },

  // Recover account using backup code
  recover: async (email: string, password: string, backupCode: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, backupCode }),
    });

    if (!response.ok) {
      throw new Error('Invalid backup code');
    }

    return response.json();
  },
};