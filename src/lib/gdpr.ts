export type ConsentType = 'marketing' | 'analytics' | 'data_sharing' | 'essential';

export interface UserConsent {
  id: string;
  userId: string;
  type: ConsentType;
  granted: boolean;
  updatedAt: string;
}

export interface DeletionRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export const gdprService = {
  async getConsents(userId: string): Promise<UserConsent[]> {
    const res = await fetch(`/api/gdpr/${userId}/consents`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateConsent(userId: string, type: ConsentType, granted: boolean): Promise<UserConsent> {
    const res = await fetch(`/api/gdpr/${userId}/consents`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, granted }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async initConsents(userId: string): Promise<UserConsent[]> {
    const res = await fetch(`/api/gdpr/${userId}/consents`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async requestDeletion(userId: string, reason?: string): Promise<DeletionRequest> {
    const res = await fetch(`/api/gdpr/${userId}/deletion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getDeletionStatus(userId: string): Promise<DeletionRequest | null> {
    const res = await fetch(`/api/gdpr/${userId}/deletion`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async exportData(userId: string): Promise<void> {
    const res = await fetch(`/api/gdpr/${userId}/export`);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `petchain-data-${userId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
