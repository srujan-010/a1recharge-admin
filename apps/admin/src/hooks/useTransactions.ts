import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface TransactionEntry {
  _id: string;
  userId: {
    _id: string;
    name: string;
    retailerId: string;
    phone: string;
    accountType?: 'RETAILER' | 'PERSONAL' | 'BUSINESS' | string;
  };
  accountType?: 'RETAILER' | 'PERSONAL' | 'BUSINESS' | string;
  transactionType: string;
  type: 'credit' | 'debit';
  amountPaise: number;
  amountRupees?: number;
  netPayablePaise?: number | null;
  netPayableRupees?: number | null;
  status: string;
  service: string;
  serviceTitle?: string;
  referenceId: string;
  orderId?: string;
  providerTransactionId?: string;
  walletDebitLedgerId?: string;
  description: string;
  closingBalancePaise: number | null;
  closingBalanceRupees?: number | null;
  mobileNumber?: string;
  targetIdentifier?: string;
  recipientName?: string;
  commissionEarnedPaise: number;
  operatorName?: string;
  apiReference?: string;
  paymentMethod: string;
  source: string;
  performedBy?: string;
  adminName?: string;
  adminId?: string;
  reason?: string;
  upiDetails?: {
    utr?: string;
    gateway?: string;
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
  };
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

export function useGlobalTransactions(
  page = 1,
  limit = 20,
  search = '',
  status = 'all',
  retailerId = '',
  service = '',
  transactionType = 'all',
  showTest = false,
  accountType = 'all',
  paymentMethod = 'all'
) {
  return useQuery({
    queryKey: ['global-transactions', page, limit, search, status, retailerId, service, transactionType, showTest, accountType, paymentMethod],
    queryFn: async () => {
      const { data } = await api.get<TransactionsResponse>('/admin/transactions', {
        params: { page, limit, search, status, retailer: retailerId, service, transactionType, showTest, accountType, paymentMethod }
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useRecharges(page = 1, limit = 20, search = '', status = 'all', operator = '', startDate = '', endDate = '', accountType = 'all', paymentMethod = 'all') {
  return useQuery({
    queryKey: ['recharges', page, limit, search, status, operator, startDate, endDate, accountType, paymentMethod],
    queryFn: async () => {
      const { data } = await api.get('/admin/recharges', {
        params: { page, limit, search, status, operator, startDate, endDate, accountType, paymentMethod }
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
