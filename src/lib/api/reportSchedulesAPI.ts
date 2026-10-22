import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';

export type ScheduledReportType = 'activity' | 'financial' | 'health' | 'usage';
export type ReportScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export type ReportRecipientScope = 'requesting_admin' | 'admin_team';

export interface ReportScheduleInput {
  reportType: ScheduledReportType;
  frequency: ReportScheduleFrequency;
  startsAt: string;
  timezone: string;
  recipientScope: ReportRecipientScope;
  expiresAt: string;
}

export interface ReportSchedule extends ReportScheduleInput {
  id: string;
  createdAt: string;
}

const api = axios.create({
  baseURL: `${getApiBaseUrl()}/analytics/reports/schedules`,
  withCredentials: true,
});

attachCorrelationInterceptor(api);

export const reportSchedulesAPI = {
  async list(): Promise<ReportSchedule[]> {
    const response = await api.get<ReportSchedule[]>('');
    return response.data;
  },

  async create(input: ReportScheduleInput): Promise<ReportSchedule> {
    const response = await api.post<ReportSchedule>('', input);
    return response.data;
  },
};
