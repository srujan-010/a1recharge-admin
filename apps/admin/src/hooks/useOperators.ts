import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ProviderOperator {
  _id: string;
  provider: string;
  name: string;
  code: string;
  serviceType: string;
  plansInfoCode?: string;
  status: boolean;
  displayOrder: number;
}

export interface OperatorsResponse {
  success: boolean;
  data: ProviderOperator[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useOperatorsList(page = 1, limit = 50, search = '', serviceType = 'all', status = 'all') {
  return useQuery({
    queryKey: ['operators', page, limit, search, serviceType, status],
    queryFn: async () => {
      const { data } = await api.get<OperatorsResponse>('/admin/operators', {
        params: { page, limit, search, serviceType, status }
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useUpdateOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      displayOrder
    }: {
      id: string;
      status?: boolean;
      displayOrder?: number;
    }) => {
      const { data } = await api.put(
        `/admin/operators/${id}`,
        { status, displayOrder }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
    },
  });
}
