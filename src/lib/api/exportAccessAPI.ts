import type { AxiosInstance } from 'axios';
import axios from 'axios';

/**
 * Client for the personal-data access decision that gates unmasked analytics
 * exports. The frontend only *asks*; the backend owns authorization and
 * consent, so every failure path here must leave the export masked.
 */

export interface PersonalDataAccessDecision {
  allowed: boolean;
  reason?: string;
  message?: string;
  scope?: { startDate?: string; endDate?: string };
}

export interface ExportDateRangeParams {
  startDate?: string;
  endDate?: string;
}

export class PersonalDataAccessError extends Error {
  readonly status?: number;
  readonly reason?: string;

  constructor(message: string, status?: number, reason?: string) {
    super(message);
    this.name = 'PersonalDataAccessError';
    this.status = status;
    this.reason = reason;
  }
}

interface UpstreamErrorBody {
  message?: string;
  reason?: string;
}

class ExportAccessAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: '/api/analytics/export',
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });
  }

  /**
   * Asks the backend whether personal data may be included in this export.
   * Resolves with the decision (including denials); rejects on transport or
   * server failures so callers can keep the preview masked.
   */
  async requestPersonalDataAccess(
    range: ExportDateRangeParams = {},
  ): Promise<PersonalDataAccessDecision> {
    try {
      const response = await this.api.get<PersonalDataAccessDecision>('/personal-data-access', {
        params: range,
      });
      const body = response.data ?? {};
      return {
        allowed: body.allowed === true,
        reason: body.reason,
        message: body.message,
        scope: body.scope,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const body = (error.response?.data ?? {}) as UpstreamErrorBody;
        throw new PersonalDataAccessError(
          body.message ?? error.message,
          error.response?.status,
          body.reason,
        );
      }
      throw new PersonalDataAccessError(
        error instanceof Error ? error.message : 'Personal-data access check failed',
      );
    }
  }
}

export const exportAccessAPI = new ExportAccessAPI();
