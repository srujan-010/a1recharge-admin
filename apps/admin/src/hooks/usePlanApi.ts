import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface PlanApiDashboardData {
  latest: {
    _id?: string;
    balance: number;
    remainingHits: number;
    responseTime: number;
    status: 'SUCCESS' | 'FAILED' | 'OFFLINE';
    errorMessage?: string | null;
    syncedAt: string | null;
    triggeredBy?: 'MANUAL' | 'AUTOMATIC';
    ipWhitelisted?: boolean;
    credentialsValid?: boolean;
  };
  settings: {
    lowBalanceWarning: number;
    criticalBalance: number;
    lowRemainingHits: number;
    criticalRemainingHits: number;
    autoRefreshInterval: number;
  };
  stats: {
    todaySyncsCount: number;
    successfulSyncsCount: number;
    failedSyncsCount: number;
    avgResponseTime: number;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastFailureMessage: string | null;
  };
  history: Array<{
    _id: string;
    balance: number;
    remainingHits: number;
    responseTime: number;
    status: 'SUCCESS' | 'FAILED' | 'OFFLINE';
    syncedAt: string;
    triggeredBy: 'MANUAL' | 'AUTOMATIC';
  }>;
}

export interface PlanApiSyncLog {
  _id: string;
  balance: number;
  remainingHits: number;
  responseTime: number;
  status: 'SUCCESS' | 'FAILED' | 'OFFLINE';
  errorMessage?: string | null;
  syncedAt: string;
  triggeredBy: 'MANUAL' | 'AUTOMATIC';
  ipWhitelisted?: boolean;
  credentialsValid?: boolean;
}

export interface PlanApiSettings {
  _id?: string;
  lowBalanceWarning: number;
  criticalBalance: number;
  lowRemainingHits: number;
  criticalRemainingHits: number;
  enableWhatsAppAlerts: boolean;
  enablePushAlerts: boolean;
  enableInternalNotifications: boolean;
  autoRefreshInterval: number;
  alertRecipients: string[];
}

export function usePlanApiDashboard(period: 'today' | '7d' | '30d' = 'today') {
  return useQuery<PlanApiDashboardData>({
    queryKey: ['planApiDashboard', period],
    queryFn: async () => {
      const res = await api.get(`/admin/planapi/dashboard?period=${period}`);
      return res.data.data;
    },
    refetchInterval: 30000, // 30 seconds polling for live status
  });
}

export function usePlanApiSyncLogs(params: {
  page?: number;
  limit?: number;
  status?: string;
  triggeredBy?: string;
  search?: string;
}) {
  return useQuery<{
    data: PlanApiSyncLog[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>({
    queryKey: ['planApiSyncLogs', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.status && params.status !== 'ALL') searchParams.set('status', params.status);
      if (params.triggeredBy && params.triggeredBy !== 'ALL') searchParams.set('triggeredBy', params.triggeredBy);
      if (params.search) searchParams.set('search', params.search);

      const res = await api.get(`/admin/planapi/logs?${searchParams.toString()}`);
      return res.data;
    },
  });
}

export function usePlanApiSettings() {
  return useQuery<PlanApiSettings>({
    queryKey: ['planApiSettings'],
    queryFn: async () => {
      const res = await api.get('/admin/planapi/settings');
      return res.data.data;
    },
  });
}

export function useTriggerPlanApiRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post('/admin/planapi/refresh');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planApiDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['planApiSyncLogs'] });
    },
  });
}

export function useUpdatePlanApiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PlanApiSettings>) => {
      const res = await api.put('/admin/planapi/settings', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planApiSettings'] });
      queryClient.invalidateQueries({ queryKey: ['planApiDashboard'] });
    },
  });
}
