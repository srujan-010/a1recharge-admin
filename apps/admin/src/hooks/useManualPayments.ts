import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

export interface ManualPaymentItem {
  _id: string;
  paymentId: string;
  retailerId: {
    _id: string;
    name: string;
    retailerId: string;
    phone: string;
    accountType?: string;
    shopName?: string;
  };
  retailerName: string;
  retailerPhone?: string;
  amountPaise: number;
  amount: number;
  paymentMethod: 'UPI' | 'BANK_TRANSFER' | 'CASH' | 'OTHER' | 'NOT_SET';
  paymentStatus: 'PAID' | 'UNPAID' | 'NOT_SET';
  walletStatus: 'CREDITED' | 'REVERSED';
  status: 'PENDING' | 'RECEIVED' | 'VERIFIED' | 'REJECTED' | 'CANCELLED' | 'PAID' | 'UNPAID';
  paymentDate: string;
  receivedAt?: string;
  receivedBy?: { _id: string; name: string; email?: string };
  receivedByName?: string;
  verifiedAt?: string;
  verifiedBy?: { _id: string; name: string; email?: string };
  verifiedByName?: string;
  createdBy: { _id: string; name: string; email?: string };
  createdByName: string;
  referenceNumber?: string;
  upiTransactionId?: string;
  utrNumber?: string;
  bankReference?: string;
  senderName?: string;
  senderUpiId?: string;
  receivedByPerson?: string;
  receiptReference?: string;
  notes?: string;
  proofImage?: string;
  walletCredited: boolean;
  walletCreditedAt?: string;
  walletCreditedBy?: { _id: string; name: string; email?: string };
  walletCreditedByName?: string;
  walletTransactionId?: any;
  walletLedgerId?: any;
  isReversed?: boolean;
  reversedAt?: string;
  reversedBy?: { _id: string; name: string };
  reversedByName?: string;
  reversalReason?: string;
  rejectionReason?: string;
  rejectedByName?: string;
  previousBalancePaise?: number;
  closingBalancePaise?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManualPaymentStats {
  todayCredits: { count: number; amount: number };
  paid: { count: number; amount: number };
  unpaid: { count: number; amount: number };
  upi: { count: number; amount: number };
  cash: { count: number; amount: number };
  bankTransfer: { count: number; amount: number };
}

export interface ManualPaymentsResponse {
  success: boolean;
  data: ManualPaymentItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useManualPayments(
  page = 1,
  limit = 20,
  search = '',
  paymentMethod = 'all',
  paymentStatus = 'all',
  walletStatus = 'all',
  tab = 'all',
  startDate = '',
  endDate = '',
  retailerId = ''
) {
  return useQuery({
    queryKey: ['manual-payments', page, limit, search, paymentMethod, paymentStatus, walletStatus, tab, startDate, endDate, retailerId],
    queryFn: async () => {
      const { data } = await api.get<ManualPaymentsResponse>('/admin/manual-payments', {
        params: {
          page,
          limit,
          search,
          paymentMethod,
          paymentStatus,
          walletStatus,
          tab,
          startDate,
          endDate,
          retailerId
        }
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useManualPaymentStats() {
  return useQuery({
    queryKey: ['manual-payment-stats'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: ManualPaymentStats }>('/admin/manual-payments/stats');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

export function useManualPaymentReconciliation() {
  return useQuery({
    queryKey: ['manual-payment-reconciliation'],
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: {
          reconciliation: any[];
          unlinkedCredits: any[];
        };
      }>('/admin/manual-payments/reconciliation');
      return data.data;
    },
  });
}

export function useRetailerManualPayments(userId: string) {
  return useQuery({
    queryKey: ['retailer-manual-payments', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await api.get<{
        success: boolean;
        data: {
          latestPayment: ManualPaymentItem | null;
          payments: ManualPaymentItem[];
        };
      }>(`/admin/manual-payments/retailer/${userId}`);
      return data.data;
    },
    enabled: !!userId,
  });
}

export function useManualPaymentDetails(id: string) {
  return useQuery({
    queryKey: ['manual-payment-details', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<{ success: boolean; data: ManualPaymentItem }>(`/admin/manual-payments/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentStatus, paymentMethod }: { id: string; paymentStatus: 'PAID' | 'UNPAID'; paymentMethod?: string }) => {
      const { data } = await api.post(`/admin/wallets/transactions/${id}/payment-status`, { paymentStatus, paymentMethod });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Payment status updated!');
      queryClient.invalidateQueries({ queryKey: ['manual-payments'] });
      queryClient.invalidateQueries({ queryKey: ['manual-payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['global-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['global-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['retailer-manual-payments'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to update payment status.');
    }
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentMethod }: { id: string; paymentMethod: 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'OTHER' }) => {
      const { data } = await api.post(`/admin/wallets/transactions/${id}/payment-method`, { paymentMethod });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Payment method updated!');
      queryClient.invalidateQueries({ queryKey: ['manual-payments'] });
      queryClient.invalidateQueries({ queryKey: ['manual-payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['global-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['global-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['retailer-manual-payments'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to update payment method.');
    }
  });
}

export function useReversePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await api.post(`/admin/wallets/transactions/${id}/reverse`, { reason });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Wallet credit reversed successfully.');
      queryClient.invalidateQueries({ queryKey: ['manual-payments'] });
      queryClient.invalidateQueries({ queryKey: ['manual-payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['manual-payment-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['retailer-manual-payments'] });
      queryClient.invalidateQueries({ queryKey: ['global-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['global-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['retailers'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to reverse payment credit.');
    }
  });
}
