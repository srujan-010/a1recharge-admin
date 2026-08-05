import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface ProviderBalanceResponse {
  success: boolean;
  provider: string;
  balance: number;
  currency: string;
  lastUpdated: string;
  status: 'online' | 'offline';
  message?: string;
}

export function useProviderBalance(providerName: string = 'A1Topup') {
  return useQuery({
    queryKey: ['provider-balance', providerName],
    queryFn: async () => {
      const { data } = await api.get<ProviderBalanceResponse>('/admin/provider/balance', {
        params: { providerName }
      });
      return data;
    },
    refetchInterval: 60000, // Auto refresh every 60 seconds
    retry: 1, // Don't retry infinitely on provider failure
  });
}
