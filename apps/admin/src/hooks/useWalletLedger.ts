import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface LedgerEntry {
  _id: string;
  userId: {
    _id: string;
    name: string;
    retailerId: string;
    phone: string;
  };
  transactionType: 'CREDIT' | 'DEBIT';
  amountPaise: number;
  balanceBeforePaise: number;
  balanceAfterPaise: number;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
}

interface LedgerResponse {
  success: boolean;
  data: LedgerEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useWalletLedgerList(page = 1, limit = 50, search = '') {
  return useQuery({
    queryKey: ['wallet-ledger', page, limit, search],
    queryFn: async () => {
      const { data } = await api.get<LedgerResponse>('/wallets/ledger', {
        params: { page, limit, search }
      });
      return data;
    },
  });
}
