import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface WalletLedgerEntry {
  _id: string;
  userId: {
    _id: string;
    name: string;
    retailerId: string;
    phone: string;
  };
  transactionType: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface LedgerResponse {
  success: boolean;
  data: WalletLedgerEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useGlobalLedger(page = 1, limit = 20, search = '') {
  return useQuery({
    queryKey: ['global-ledger', page, limit, search],
    queryFn: async () => {
      const { data } = await api.get<LedgerResponse>('/admin/wallets/ledger', {
        params: { page, limit, search }
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useManualAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      type,
      amountPaise,
      reason,
      paymentMethod = 'UPI',
      paymentStatus = 'PAID',
      referenceId,
      idempotencyKey
    }: {
      userId: string;
      type: 'credit' | 'debit';
      amountPaise: number;
      reason: string;
      paymentMethod?: string;
      paymentStatus?: string;
      referenceId?: string;
      idempotencyKey?: string;
    }) => {
      const { data } = await api.post(
        `/admin/wallets/${userId}/adjust`,
        { type, amountPaise, reason, paymentMethod, paymentStatus, referenceId },
        { headers: { 'Idempotency-Key': idempotencyKey || referenceId || `adj_${userId}_${Date.now()}` } }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['global-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['global-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['manual-payments'] });
      queryClient.invalidateQueries({ queryKey: ['manual-payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['retailer-manual-payments'] });
      queryClient.invalidateQueries({ queryKey: ['retailer', variables.userId] });
    },
  });
}
