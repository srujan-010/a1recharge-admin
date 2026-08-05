import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface TransactionReportRow {
  date: string;
  status: string;
  service: string;
  totalCount: number;
  totalAmountPaise: number;
  totalCommissionPaise: number;
}

export interface LedgerReportRow {
  date: string;
  type: string;
  transactionType: string;
  totalCount: number;
  totalAmountPaise: number;
}

export function useTransactionReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-transactions', startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: TransactionReportRow[] }>('/admin/reports/transactions', {
        params: { startDate, endDate }
      });
      return data.data;
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useLedgerReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['report-ledger', startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: LedgerReportRow[] }>('/admin/reports/ledger', {
        params: { startDate, endDate }
      });
      return data.data;
    },
    enabled: !!startDate && !!endDate,
  });
}
