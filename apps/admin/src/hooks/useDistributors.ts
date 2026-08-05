import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Distributor {
  _id: string;
  name: string;
  phone: string;
  email: string;
  retailerId: string;
  shopName: string;
  status: string;
  walletBalancePaise: number;
  isOnboarded: boolean;
  kycStatus: string;
  createdAt: string;
}

interface DistributorsResponse {
  success: boolean;
  data: Distributor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useDistributorsList(page = 1, limit = 20, search = '', status = 'all') {
  return useQuery({
    queryKey: ['distributors', page, limit, search, status],
    queryFn: async () => {
      const { data } = await api.get<DistributorsResponse>('/distributors', {
        params: { page, limit, search, status }
      });
      return data;
    },
  });
}
