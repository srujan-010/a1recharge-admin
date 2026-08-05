import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface WabaStatusData {
  waba?: {
    waba_id?: number | string;
    phone_number_id?: number | string;
    number?: string;
    verified_name?: string;
    name_status?: string;
    quality_rating?: string;
    messaging_limit?: string;
    platform_type?: string;
    connection_status?: string;
    error?: string;
  };
  wallet?: {
    return?: boolean;
    walletBalance?: number;
    smsCount?: number;
  };
}

export interface WhatsAppTemplateItem {
  _id: string;
  messageId: number;
  templateId: string;
  templateName: string;
  phoneNumberId?: string;
  senderNumber?: string;
  category: string;
  status: string;
  language: string;
  varCount: number;
  components: any[];
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  buttons?: any[];
  exampleValues?: any[];
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'NONE';
  lastSyncedAt: string;
}

export interface WhatsAppCampaignLog {
  _id: string;
  messageId: number;
  templateId?: string;
  templateName?: string;
  phoneNumberId?: string;
  recipients: string[];
  recipientCount: number;
  variablesValues?: string;
  mediaUrl?: string;
  documentFilename?: string;
  status: 'DELIVERED' | 'FAILED' | 'PENDING';
  requestId?: string;
  sentBy?: { name: string };
  source: 'MANUAL' | 'AUTOMATIC';
  sentCount: number;
  failedCount: number;
  errorDetails?: string;
  createdAt: string;
  // Enriched fields from backend
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  ratePerMessage?: number;
  totalCost?: number;
}

export interface WhatsAppAnalyticsData {
  totalCampaigns: number;
  totalSent: number;
  deliveredCount: number;
  failedCount: number;
  successRate: number;
  topTemplates: Array<{ _id: string; count: number; totalSent: number }>;
}

export function useWabaStatus() {
  return useQuery({
    queryKey: ['wabaStatus'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: WabaStatusData }>('/admin/whatsapp/status');
      return data.data;
    },
    refetchInterval: 60000,
  });
}

export function useWhatsAppTemplates(params?: {
  search?: string;
  category?: string;
  language?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['whatsAppTemplates', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('search', params.search);
      if (params?.category) queryParams.set('category', params.category);
      if (params?.language) queryParams.set('language', params.language);
      if (params?.status) queryParams.set('status', params.status);

      const { data } = await api.get<{ success: boolean; count: number; data: WhatsAppTemplateItem[] }>(
        `/admin/whatsapp/templates?${queryParams.toString()}`
      );
      return data.data;
    },
  });
}

export function useSyncWhatsAppTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/whatsapp/templates/sync');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsAppTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['wabaStatus'] });
    },
  });
}

export function useCreateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      templateName: string;
      category?: string;
      language?: string;
      templateType?: string;
      headerText?: string;
      bodyText: string;
      footerText?: string;
      buttons?: any[];
      mediaType?: string;
      exampleValues?: string[];
    }) => {
      const { data } = await api.post('/admin/whatsapp/templates', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsAppTemplates'] });
    },
  });
}

export function useUpdateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/admin/whatsapp/templates/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsAppTemplates'] });
    },
  });
}

export function useDeleteWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/whatsapp/templates/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsAppTemplates'] });
    },
  });
}

export function useDuplicateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/whatsapp/templates/${id}/duplicate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsAppTemplates'] });
    },
  });
}

export function useSendWhatsAppCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      recipients: 'ALL' | 'MULTIPLE' | 'SINGLE';
      targetMobile?: string;
      messageId: number;
      templateId?: string;
      variablesValues?: string | string[];
      mediaUrl?: string;
      documentFilename?: string;
      filters?: { state?: string; district?: string; kycStatus?: string };
    }) => {
      const idempotencyKey = `wa_send_${Date.now()}`;
      const { data } = await api.post('/admin/whatsapp/send', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsAppHistory'] });
      queryClient.invalidateQueries({ queryKey: ['whatsAppAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['wabaStatus'] });
    },
  });
}

export function useWhatsAppHistory(params?: { search?: string; status?: string; limit?: number }) {
  return useQuery({
    queryKey: ['whatsAppHistory', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('search', params.search);
      if (params?.status) queryParams.set('status', params.status);
      if (params?.limit) queryParams.set('limit', String(params.limit));

      const { data } = await api.get<{ success: boolean; count: number; data: WhatsAppCampaignLog[] }>(
        `/admin/whatsapp/history?${queryParams.toString()}`
      );
      return data.data;
    },
  });
}

export function useWhatsAppAnalytics() {
  return useQuery({
    queryKey: ['whatsAppAnalytics'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: WhatsAppAnalyticsData }>('/admin/whatsapp/analytics');
      return data.data;
    },
  });
}

export function useWhatsAppDeliveryReport(requestId?: string, autoPoll = false) {
  return useQuery({
    queryKey: ['whatsAppDeliveryReport', requestId],
    queryFn: async () => {
      if (!requestId) return null;
      const { data } = await api.get<{ success: boolean; data: any }>(`/admin/whatsapp/delivery-report/${requestId}`);
      return data.data;
    },
    enabled: !!requestId,
    refetchInterval: autoPoll ? 15000 : false, // Poll every 15s if enabled
  });
}

export function useWhatsAppLogs(params?: {
  from?: string;
  to?: string;
  search?: string;
  status?: string;
  category?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['whatsAppLogs', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.from) queryParams.set('from', params.from);
      if (params?.to) queryParams.set('to', params.to);
      if (params?.search) queryParams.set('search', params.search);
      if (params?.status) queryParams.set('status', params.status);
      if (params?.category) queryParams.set('category', params.category);
      if (params?.limit) queryParams.set('limit', String(params.limit));

      const { data } = await api.get<{ success: boolean; count: number; data: WhatsAppCampaignLog[] }>(
        `/admin/whatsapp/logs?${queryParams.toString()}`
      );
      return data.data;
    },
  });
}

export function useWhatsAppLogsSummary() {
  return useQuery({
    queryKey: ['whatsAppLogsSummary'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: any }>('/admin/whatsapp/logs-summary');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

export function useWhatsAppSummary(days = 30) {
  return useQuery({
    queryKey: ['whatsAppSummary', days],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: any }>(`/admin/whatsapp/summary?days=${days}`);
      return data.data;
    },
  });
}

export function useWhatsAppRecipientStats(params?: {
  recipients?: string;
  targetMobile?: string;
  state?: string;
  district?: string;
  kycStatus?: string;
}) {
  return useQuery({
    queryKey: ['whatsAppRecipientStats', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.recipients) queryParams.set('recipients', params.recipients);
      if (params?.targetMobile) queryParams.set('targetMobile', params.targetMobile);
      if (params?.state) queryParams.set('state', params.state);
      if (params?.district) queryParams.set('district', params.district);
      if (params?.kycStatus) queryParams.set('kycStatus', params.kycStatus);

      const { data } = await api.get<{ success: boolean; data: any }>(
        `/admin/whatsapp/recipients-stats?${queryParams.toString()}`
      );
      return data.data;
    },
  });
}

export function useFast2SMSWalletLedgerTransactions(params?: {
  page?: number;
  limit?: number;
  period?: string;
  category?: string;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['fast2smsWalletLedgerTransactions', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.set('page', String(params.page));
      if (params?.limit) queryParams.set('limit', String(params.limit));
      if (params?.period) queryParams.set('period', params.period);
      if (params?.category) queryParams.set('category', params.category);
      if (params?.status) queryParams.set('status', params.status);
      if (params?.search) queryParams.set('search', params.search);

      const { data } = await api.get<{ success: boolean; data: any[]; pagination: any }>(
        `/admin/whatsapp/fast2sms-wallet-transactions?${queryParams.toString()}`
      );
      return data;
    },
  });
}

export function useFast2SMSWalletLedgerStats() {
  return useQuery({
    queryKey: ['fast2smsWalletLedgerStats'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: any }>('/admin/whatsapp/fast2sms-wallet-stats');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

