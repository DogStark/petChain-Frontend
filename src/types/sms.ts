export type SmsDeliveryStatus = 'sent' | 'delivered' | 'failed' | 'pending';

export interface SmsDeliveryStats {
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
}

export interface SmsDeliveryTrendPoint {
  /** ISO date (YYYY-MM-DD) the bucket starts on */
  date: string;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  /** delivered / sent * 100, 0 when nothing was sent */
  deliveryRate: number;
}

export interface SmsDeliveryStatsResponse {
  range: {
    startDate: string;
    endDate: string;
  };
  totals: SmsDeliveryStats;
  trend: SmsDeliveryTrendPoint[];
}

export interface SmsDateRange {
  startDate: string;
  endDate: string;
}
