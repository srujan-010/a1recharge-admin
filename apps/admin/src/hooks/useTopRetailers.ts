import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface RetailerBreakdownDetail {
  volumePaise: number;
  count: number;
}

export interface TopRetailerItem {
  rank: number;
  retailerId: string;
  retailerCode: string;
  name: string;
  phone: string;
  email: string | null;
  accountType: 'RETAILER' | 'BUSINESS' | 'PERSONAL';
  rechargeVolumePaise: number;
  successfulRecharges: number;
  failedRecharges: number;
  totalAttempts: number;
  commissionPaise: number;
  averageRechargePaise: number;
  successRate: number;
  lastRechargeAt: string;
  serviceBreakdown: {
    mobile: RetailerBreakdownDetail;
    dth: RetailerBreakdownDetail;
  };
  paymentMethodBreakdown: {
    wallet: RetailerBreakdownDetail;
    upi: RetailerBreakdownDetail;
  };
}

export interface TopRetailersSummary {
  totalRechargeVolumePaise: number;
  successfulRechargeCount: number;
  totalCommissionPaise: number;
  activeRetailerCount: number;
}

export interface TopRetailersData {
  period: {
    name: string;
    startDate: string;
    endDate: string;
  };
  summary: TopRetailersSummary;
  topRetailer: TopRetailerItem | null;
  retailers: TopRetailerItem[];
  pagination: {
    total: number;
    limit: number;
    displayed: number;
  };
}

export interface TopRetailersResponse {
  success: boolean;
  data: TopRetailersData;
}

export interface UseTopRetailersParams {
  startDate?: string;
  endDate?: string;
  period?: string;
  sortBy?: 'volume' | 'count' | 'commission' | 'successRate';
  sortOrder?: 'desc' | 'asc';
  limit?: number;
  accountType?: string;
}

export function useTopRetailers(params: UseTopRetailersParams) {
  const {
    startDate,
    endDate,
    period = 'today',
    sortBy = 'volume',
    sortOrder = 'desc',
    limit = 10,
    accountType = 'all',
  } = params;

  return useQuery({
    queryKey: ['top-retailers-analytics', startDate, endDate, period, sortBy, sortOrder, limit, accountType],
    queryFn: async () => {
      const { data } = await api.get<TopRetailersResponse>('/admin/reports/top-retailers', {
        params: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          period,
          sortBy,
          sortOrder,
          limit,
          accountType: accountType !== 'all' ? accountType : undefined,
        },
      });
      return data.data;
    },
    staleTime: 1000 * 30, // 30 seconds fresh
    refetchOnWindowFocus: false,
  });
}
