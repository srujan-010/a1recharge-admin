import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ProviderWallet {
  _id: string;
  providerName: string;
  balance: number;
  currency: string;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProvidersResponse {
  success: boolean;
  data: ProviderWallet[];
}

export function useProvidersList() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const { data } = await api.get<ProvidersResponse>('/admin/providers');
      return data.data;
    },
  });
}

export function useRefreshProviderBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      const idempotencyKey = `sync_provider_${providerId}_${Date.now()}`;
      const { data } = await api.post(
        `/admin/providers/${providerId}/refresh-balance`,
        {},
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      // Also invalidate dashboard stats as provider balance might be displayed there
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
