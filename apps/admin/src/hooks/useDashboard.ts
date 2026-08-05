import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDashboardStats(period: string = 'today') {
  return useQuery({
    queryKey: ['dashboardStats', period],
    queryFn: async () => {
      const response = await api.get(`/admin/dashboard/stats?period=${period}`);
      return response.data.data;
    },
    refetchInterval: 30000, // Refresh every 30s
  });
}

export function useRevenueTrend() {
  return useQuery({
    queryKey: ['revenueTrend'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/trend');
      return response.data.data;
    },
  });
}

export function useLiveFeed() {
  return useQuery({
    queryKey: ['liveFeed'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/live');
      return response.data.data;
    },
    refetchInterval: 5000, // Pull every 5 seconds
  });
}
