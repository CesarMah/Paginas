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

export interface RangeReport {
  startDate: string;
  endDate: string;
  dailyData: Array<{ date: string; revenue: number; orders: number }>;
  totalRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  avgTicket: number;
  topProducts: Array<{ name: string; count: number; revenue: number }>;
  statusBreakdown: Record<string, number>;
}

export const analyticsApi = {
  daily: (date?: string) => {
    const qs = date ? `?date=${date}` : '';
    return apiFetch<DailyReport>(`/reports/daily${qs}`);
  },

  range: (startDate: string, endDate: string) => {
    return apiFetch<RangeReport>(`/reports/weekly?startDate=${startDate}&endDate=${endDate}`);
  },
};
