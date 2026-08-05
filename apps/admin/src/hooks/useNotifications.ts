import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface NotificationRecord {
  _id: string;
  title: string;
  message: string;
  category: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR' | 'OFFER' | 'SYSTEM';
  action: string | null;
  createdAt: string;
}

export function useRecentBroadcasts(limit = 20) {
  return useQuery({
    queryKey: ['broadcasts', limit],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: NotificationRecord[] }>('/admin/notifications/broadcasts', {
        params: { limit }
      });
      return data.data;
    },
  });
}

export function useSendBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      message: string;
      category: string;
      action: string;
    }) => {
      const idempotencyKey = `broadcast_${Date.now()}`;
      const { data } = await api.post(
        '/admin/notifications/broadcast',
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });
}
