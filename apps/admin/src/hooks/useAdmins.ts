import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
  createdAt: string;
}

interface AdminsResponse {
  success: boolean;
  data: AdminUser[];
}

export function useAdminsList() {
  return useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const { data } = await api.get<AdminsResponse>('/users');
      return data.data;
    },
  });
}

export function useUpdateAdminStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status, role }: { id: string, status?: string, role?: string }) => {
      const { data } = await api.put(`/users/${id}`, { status, role });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
  });
}
