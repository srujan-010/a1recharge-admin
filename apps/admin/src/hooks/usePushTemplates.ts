import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface PushTemplate {
  _id: string;
  name: string;
  category: string;
  title: string;
  body: string;
  bannerImage?: string | null;
  deepLink?: string | null;
  priority: 'high' | 'normal';
  ttl: number;
  variables: string[];
  tags: string[];
  isFavorite: boolean;
  isSystemTemplate: boolean;
  usageCount: number;
  createdBy?: { name: string } | null;
  updatedBy?: { name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateCategory {
  id: string;
  label: string;
  description: string;
}

export function usePushTemplates(params?: {
  search?: string;
  category?: string;
  isFavorite?: boolean;
  isSystemTemplate?: boolean;
}) {
  return useQuery({
    queryKey: ['pushTemplates', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('search', params.search);
      if (params?.category) queryParams.set('category', params.category);
      if (params?.isFavorite) queryParams.set('isFavorite', 'true');
      if (params?.isSystemTemplate !== undefined) queryParams.set('isSystemTemplate', String(params.isSystemTemplate));

      const { data } = await api.get<{ success: boolean; data: PushTemplate[] }>(
        `/admin/push-notifications/templates?${queryParams.toString()}`
      );
      return data.data;
    },
  });
}

export function useTemplateCategories() {
  return useQuery({
    queryKey: ['pushTemplateCategories'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: TemplateCategory[] }>(
        '/admin/push-notifications/templates/categories'
      );
      return data.data;
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PushTemplate>) => {
      const idempotencyKey = `create_template_${Date.now()}`;
      const { data } = await api.post('/admin/push-notifications/templates', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pushTemplates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<PushTemplate> }) => {
      const { data } = await api.put(`/admin/push-notifications/templates/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pushTemplates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/push-notifications/templates/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pushTemplates'] });
    },
  });
}

export function useToggleFavoriteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/push-notifications/templates/${id}/favorite`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pushTemplates'] });
    },
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/push-notifications/templates/${id}/duplicate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pushTemplates'] });
    },
  });
}
