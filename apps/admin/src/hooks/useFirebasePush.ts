import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function usePushNotificationHistory(limit = 100) {
  return useQuery({
    queryKey: ['push-history', limit],
    queryFn: async () => {
      const { data } = await api.get('/admin/push-notifications/history', {
        params: { limit }
      });
      return data.data;
    },
  });
}

export function useDeviceTokens(limit = 100) {
  return useQuery({
    queryKey: ['device-tokens', limit],
    queryFn: async () => {
      const { data } = await api.get('/admin/push-notifications/device-tokens', {
        params: { limit }
      });
      return data.data;
    },
  });
}

export function useSendPushNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const idempotencyKey = `push_${Date.now()}`;
      const { data } = await api.post('/admin/push-notifications/send', payload, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-history'] });
    },
  });
}

export function useTestPushNotification() {
  return useMutation({
    mutationFn: async (payload: { fcmToken: string; title: string; body: string }) => {
      const { data } = await api.post('/admin/push-notifications/test', payload);
      return data;
    },
  });
}

export function useDeleteDeviceToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/admin/push-notifications/device-tokens/${userId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-tokens'] });
    },
  });
}
