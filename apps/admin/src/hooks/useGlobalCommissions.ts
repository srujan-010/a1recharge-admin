import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface GlobalCommission {
  _id: string | null;
  accountType: 'PERSONAL' | 'BUSINESS';
  operatorCode: string;
  operatorName: string;
  serviceType: string;
  providerCommission: number;
  retailerCommission: number;
  companyCommission: number;
  status: 'ACTIVE' | 'INACTIVE';
  poStatus: boolean;
}

export interface CommissionStats {
  personalSlabs: number;
  businessSlabs: number;
  activeSlabs: number;
  inactiveSlabs: number;
  personalActive: number;
  businessActive: number;
}

export interface CommissionsResponse {
  success: boolean;
  stats?: CommissionStats;
  data: GlobalCommission[];
}

export function useGlobalCommissionsList(accountType = 'ALL') {
  return useQuery({
    queryKey: ['globalCommissions', accountType],
    queryFn: async () => {
      const { data } = await api.get<CommissionsResponse>('/admin/commissions', {
        params: { accountType }
      });
      return data;
    },
  });
}

export function useCreateGlobalCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      accountType: 'PERSONAL' | 'BUSINESS';
      operatorCode: string;
      operatorName?: string;
      providerCommission: number;
      retailerCommission: number;
      status?: 'ACTIVE' | 'INACTIVE';
    }) => {
      const { data } = await api.post('/admin/commissions', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalCommissions'] });
    },
  });
}

export function useUpdateGlobalCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      code,
      payload
    }: {
      code: string;
      payload: { providerCommission: number; retailerCommission: number; status?: 'ACTIVE' | 'INACTIVE'; operatorName?: string; accountType?: string; }
    }) => {
      const { data } = await api.put(`/admin/commissions/${code}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalCommissions'] });
    },
  });
}
