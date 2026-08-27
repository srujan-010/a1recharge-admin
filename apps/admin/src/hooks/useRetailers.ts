import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Retailer {
  _id: string;
  retailerId: string;
  name: string;
  phone: string;
  email?: string;
  shopName?: string;
  city?: string;
  state?: string;
  accountType?: 'PERSONAL' | 'BUSINESS';
  status: 'active' | 'suspended' | 'blocked';
  kycStatus: 'pending' | 'verified' | 'rejected' | 'none';
  walletBalancePaise: number;
  todaysRechargePaise?: number;
  monthlyRechargePaise?: number;
  lastLogin?: string;
  createdAt: string;
  fcmToken?: string | null;
  deviceModel?: string;
  deviceManufacturer?: string;
  androidVersion?: string;
  appVersion?: string;
  tokenUpdatedAt?: string;
  // Lock Fields
  isLocked?: boolean;
  lockUntil?: string | null;
  lockReason?: string | null;
  lockTime?: string | null;
  failedMpinAttempts?: number;
  failedLoginAttempts?: number;
}

export interface RetailersResponse {
  success: boolean;
  data: Retailer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useRetailersList(page = 1, limit = 20, search = '', status = 'all', accountType = 'all') {
  return useQuery({
    queryKey: ['retailers', page, limit, search, status, accountType],
    queryFn: async () => {
      const { data } = await api.get<RetailersResponse>('/admin/retailers', {
        params: { page, limit, search, status, accountType }
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useRetailerProfile(id: string) {
  return useQuery({
    queryKey: ['retailer', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/retailers/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useUpdateRetailerStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const { data } = await api.put(`/admin/retailers/${id}/status`, { status, reason });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retailers'] });
      queryClient.invalidateQueries({ queryKey: ['retailer', variables.id] });
    },
  });
}

export function useUpdateRetailerAccountType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accountType }: { id: string; accountType: 'PERSONAL' | 'BUSINESS' }) => {
      const { data } = await api.put(`/admin/retailers/${id}/account-type`, { accountType });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retailers'] });
      queryClient.invalidateQueries({ queryKey: ['retailer', variables.id] });
    },
  });
}

export function useUnlockRetailerAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/retailers/${id}/unlock`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['retailers'] });
      queryClient.invalidateQueries({ queryKey: ['retailer', id] });
    },
  });
}

export function useUpdateRetailerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; phone?: string; email?: string; shopName?: string; city?: string; state?: string; accountType?: 'PERSONAL' | 'BUSINESS' }) => {
      const { data } = await api.put(`/admin/retailers/${id}`, payload);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retailers'] });
      queryClient.invalidateQueries({ queryKey: ['retailer', variables.id] });
    },
  });
}

export function useDeleteRetailer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/retailers/${id}`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['retailers'] });
      queryClient.invalidateQueries({ queryKey: ['retailer', id] });
    },
  });
}

export function useResetRetailerSecurity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/retailers/${id}/reset-security`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['retailers'] });
      queryClient.invalidateQueries({ queryKey: ['retailer', id] });
    },
  });
}

export function useRevokeRetailerSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/retailers/${id}/revoke-sessions`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['retailers'] });
      queryClient.invalidateQueries({ queryKey: ['retailer', id] });
    },
  });
}

export function useSendPushNotification() {
  return useMutation({
    mutationFn: async ({ recipients, title, body }: { recipients: string[]; title: string; body: string }) => {
      const { data } = await api.post('/admin/push-notifications/send', { recipients, title, body });
      return data;
    },
  });
}

export function useSendDirectSMS() {
  return useMutation({
    mutationFn: async ({ userId, phone, message }: { userId?: string; phone?: string; message: string }) => {
      const { data } = await api.post('/admin/notifications/send-sms', { userId, phone, message });
      return data;
    },
  });
}

export function useCreateRetailer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      phone: string;
      email?: string;
      shopName?: string;
      city?: string;
      state?: string;
      accountType?: 'PERSONAL' | 'BUSINESS';
    }) => {
      const { data } = await api.post('/auth/register', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retailers'] });
    },
  });
}
