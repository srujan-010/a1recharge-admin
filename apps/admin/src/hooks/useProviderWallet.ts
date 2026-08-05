import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useProviderWalletStats(period: string = 'today') {
  return useQuery({
    queryKey: ['providerWalletStats', period],
    queryFn: async () => {
      const res = await api.get(`/admin/provider-wallet/dashboard?period=${period}`);
      return res.data.data;
    },
    refetchInterval: 60000, // refresh every 60 seconds
  });
}

export function useProviderWalletTransactions({
  page = 1,
  limit = 25,
  period = 'today',
  status = 'ALL',
  search = '',
}: {
  page?: number;
  limit?: number;
  period?: string;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['providerWalletTransactions', page, limit, period, status, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        period,
        status,
        search,
      });
      const res = await api.get(`/admin/provider-wallet/transactions?${params.toString()}`);
      return res.data;
    },
    refetchInterval: 60000,
  });
}
