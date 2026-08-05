import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface AppBanner {
  imageUrl: string;
  link?: string;
  isActive: boolean;
}

export interface AppSettings {
  _id: string;
  appName: string;
  supportNumber: string;
  whatsappNumber: string;
  supportEmail: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minimumRecharge: number;
  maximumRecharge: number;
  banners?: AppBanner[];
  features: {
    bbps: boolean;
    aeps: boolean;
    dmt: boolean;
    insurance: boolean;
    pan: boolean;
  };
  appVersion: {
    latestVersion: string;
    minimumSupportedVersion: string;
    forceUpdate: boolean;
    playStoreUrl: string;
  };
}

export function useSettings() {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: AppSettings }>('/admin/settings');
      return data.data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AppSettings>) => {
      const idempotencyKey = `update_settings_${Date.now()}`;
      const { data } = await api.put(
        '/admin/settings',
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
  });
}
