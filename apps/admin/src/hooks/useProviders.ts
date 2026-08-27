import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ProviderWallet {
  _id: string;
  providerName: string;
  balance: number;
  currency: string;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProvidersResponse {
  success: boolean;
  data: ProviderWallet[];
}

export function useProvidersList() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const { data } = await api.get<ProvidersResponse>('/admin/providers');
      return data.data;
    },
  });
}

export function useRefreshProviderBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      const idempotencyKey = `sync_provider_${providerId}_${Date.now()}`;
      const { data } = await api.post(
        `/admin/providers/${providerId}/refresh-balance`,
        {},
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export interface ProviderAutomationSettingsData {
  enabled: boolean;
  providerName: string;
  threshold: number;
  recipients: string[];
  templateName: string;
  messageId: number;
  phoneNumberId: string;
  lastCheckAt?: string;
  lastAlertAt?: string;
  lastBalance?: number;
  lastStatus: 'NORMAL' | 'LOW_BALANCE' | 'UNKNOWN';
}

export interface ProviderAutomationLogItem {
  _id: string;
  transactionId: string;
  rechargeOrderId?: string;
  rechargeAmount: number;
  providerName: string;
  providerBalance?: number;
  threshold: number;
  detectedAt: string;
  overallStatus: 'ALERT_SENT' | 'PARTIAL_SUCCESS' | 'FAILED' | 'NO_ALERT_NEEDED' | 'ERROR_SKIPPED' | 'DISABLED';
  recipientsStatus: Array<{
    recipient: string;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    requestId?: string;
    errorDetails?: string;
    sentAt: string;
  }>;
  errorDetails?: string;
  executionTimeMs?: number;
}

export function useProviderAutomationSettings() {
  return useQuery({
    queryKey: ['provider-automation-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: ProviderAutomationSettingsData }>('/admin/provider-automations/settings');
      return data.data;
    },
    refetchInterval: 15000,
  });
}

export function useUpdateProviderAutomationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ProviderAutomationSettingsData>) => {
      const { data } = await api.put('/admin/provider-automations/settings', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-automation-settings'] });
    },
  });
}

export function useProviderAutomationLogs(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['provider-automation-logs', page, limit],
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: ProviderAutomationLogItem[];
        pagination: { total: number; page: number; limit: number; pages: number };
      }>(`/admin/provider-automations/logs?page=${page}&limit=${limit}`);
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useSendProviderAutomationTest() {
  return useMutation({
    mutationFn: async (testNumber: string) => {
      const { data } = await api.post('/admin/provider-automations/test', { testNumber });
      return data;
    },
  });
}

