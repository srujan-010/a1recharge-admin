import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface GlobalCommission {
  _id: string | null;
  operatorCode: string;
  operatorName: string;
  serviceType: string;
  providerCommission: number;
  retailerCommission: number;
  companyCommission: number;
  status: 'ACTIVE' | 'INACTIVE';
  poStatus: boolean;
}

export function useGlobalCommissionsList() {
  return useQuery({
    queryKey: ['globalCommissions'],
    queryFn: async () => {
      const { data } = await api.get('/admin/commissions');
      return data.data as GlobalCommission[];
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
      payload: { providerCommission: number; retailerCommission: number; status?: 'ACTIVE' | 'INACTIVE'; operatorName?: string; }
    }) => {
      const { data } = await api.put(`/admin/commissions/${code}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalCommissions'] });
    },
  });
}
