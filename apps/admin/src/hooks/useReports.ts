import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface FinancialSummaryData {
  rechargeVolumeRupees: number;
  providerCommRupees: number;
  retailerCommRupees: number;
  personalCommRupees: number;
  businessCommRupees: number;
  companyProfitRupees: number;
  totalCommissionRupees: number;
  avgProfitPerSuccessTx: number;
  profitMarginPct: number;
  rechargeVolume: string;
  providerCommission: string;
  retailerCommission: string;
  netProfit: string;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  totalCount: number;
  successRate: number;
  dateRange: { startDate: string; endDate: string };
}

export interface AccountTypeMetrics {
  rechargeVolume: number;
  providerCommission: number;
  retailerCommission: number;
  companyProfit: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  totalCount: number;
  successRate: number;
}

export interface PersonalVsBusinessData {
  PERSONAL: AccountTypeMetrics;
  BUSINESS: AccountTypeMetrics;
}

export interface DailyPerformanceRow {
  date: string;
  rechargeVolume: number;
  providerCommission: number;
  retailerCommission: number;
  companyProfit: number;
  successful: number;
  failed: number;
  pending: number;
  total: number;
  successRate: number;
}

export interface OperatorPerformanceRow {
  operatorCode: string;
  operatorName: string;
  rechargeVolume: number;
  providerCommission: number;
  retailerCommission: number;
  companyProfit: number;
  successful: number;
  failed: number;
  pending: number;
  total: number;
  successRate: number;
}

export interface PeriodComparisonMetric {
  current: number;
  previous: number;
  diff: number;
  pct: number;
}

export interface PeriodComparisonData {
  rechargeVolume: PeriodComparisonMetric;
  providerCommission: PeriodComparisonMetric;
  retailerCommission: PeriodComparisonMetric;
  companyProfit: PeriodComparisonMetric;
  transactions: PeriodComparisonMetric;
  previousDateRange: { startDate: string; endDate: string };
}

export interface ExecutiveDashboardData {
  summary: FinancialSummaryData;
  personalVsBusiness: PersonalVsBusinessData;
  dailyPerformance: DailyPerformanceRow[];
  operatorPerformance: OperatorPerformanceRow[];
  periodComparison: PeriodComparisonData;
}

export interface ExecutiveDashboardResponse {
  success: boolean;
  data: ExecutiveDashboardData;
}

export function useExecutiveDashboardReport(params: {
  startDate?: string;
  endDate?: string;
  period?: string;
  accountType?: string;
}) {
  const { startDate, endDate, period = '30d', accountType = 'all' } = params;

  return useQuery({
    queryKey: ['executive-dashboard-report', startDate, endDate, period, accountType],
    queryFn: async () => {
      const { data } = await api.get<ExecutiveDashboardResponse>('/admin/reports/dashboard', {
        params: { startDate, endDate, period, accountType }
      });
      return data.data;
    },
    staleTime: 0, // Always fresh on refetch
  });
}

export interface LedgerReportRow {
  date: string;
  type: string;
  transactionType: string;
  totalCount: number;
  totalAmountRupees: number;
  totalAmountPaise: number;
}

export function useLedgerReport(startDate?: string, endDate?: string, period?: string) {
  return useQuery({
    queryKey: ['report-ledger', startDate, endDate, period],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: LedgerReportRow[] }>('/admin/reports/ledger', {
        params: { startDate, endDate, period }
      });
      return data.data;
    },
  });
}
