import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface TransactionEntry {
  _id: string;
  userId: {
    _id: string;
    name: string;
    retailerId: string;
    phone: string;
  };
  type: 'credit' | 'debit';
  amountPaise: number;
  status: 'success' | 'pending' | 'failed' | 'reversed';
  service: string;
  referenceId: string;
  description: string;
  closingBalancePaise: number;
  mobileNumber?: string;
  recipientName?: string;
  commissionEarnedPaise: number;
  operatorName?: string;
  apiReference?: string;
  paymentMethod: string;
  createdAt: string;
}

export interface TransactionsResponse {
  success: boolean;
  data: TransactionEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useGlobalTransactions(page = 1, limit = 20, search = '', status = 'all', retailerId = '', service = '', showTest = false) {
  return useQuery({
    queryKey: ['global-transactions', page, limit, search, status, retailerId, service, showTest],
    queryFn: async () => {
      const { data } = await api.get<TransactionsResponse>('/admin/transactions', {
        params: { page, limit, search, status, retailer: retailerId, service, showTest }
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useRecharges(page = 1, limit = 20, search = '', status = 'all', operator = '', startDate = '', endDate = '') {
  return useQuery({
    queryKey: ['recharges', page, limit, search, status, operator, startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get('/admin/recharges', {
        params: { page, limit, search, status, operator, startDate, endDate }
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useRechargeDetails(orderId: string) {
  return useQuery({
    queryKey: ['recharge-details', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await api.get(`/admin/recharges/${orderId}/details`);
      return data.data;
    },
    enabled: !!orderId,
  });
}
