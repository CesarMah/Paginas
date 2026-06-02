import { apiFetch } from './client';

export interface DailyReport {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  topProducts: Array<{ name: string; count: number; revenue: number }>;
  hourlyRevenue: Array<{ hour: number; revenue: number }>;
  statusBreakdown: Record<string, number>;
}

export interface WeeklyReport {
  endDate: string;
  dailyData: Array<{ date: string; revenue: number; orders: number }>;
}

export const analyticsApi = {
  daily: (date?: string) => {
    const qs = date ? `?date=${date}` : '';
    return apiFetch<DailyReport>(`/reports/daily${qs}`);
  },

  weekly: (endDate?: string) => {
    const qs = endDate ? `?endDate=${endDate}` : '';
    return apiFetch<WeeklyReport>(`/reports/weekly${qs}`);
  },
};
