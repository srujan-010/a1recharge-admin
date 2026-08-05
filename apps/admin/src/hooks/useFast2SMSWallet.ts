import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Fast2SMSWalletData {
  provider: string;
  walletBalance: number;
  smsCount: number;
  status: 'Connected' | 'Disconnected';
  lastUpdated: string | null;
  isCached: boolean;
  warning: string | null;
}

export function useFast2SMSWallet() {
  return useQuery<Fast2SMSWalletData>({
    queryKey: ['fast2smsWallet'],
    queryFn: async () => {
      const res = await api.get('/admin/providers/fast2sms/wallet');
      return res.data.data;
    },
    refetchInterval: 60000, // Auto refresh every 60 seconds
  });
}
