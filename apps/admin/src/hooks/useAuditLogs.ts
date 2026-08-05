import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface AuditLog {
  _id: string;
  adminId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  action: string;
  module: string;
  targetId?: string;
  oldData?: any;
  newData?: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export function useAuditLogs(page = 1, limit = 20, module = 'ALL') {
  return useQuery({
    queryKey: ['audit-logs', page, limit, module],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: AuditLog[]; pagination: any }>('/admin/audit-logs', {
        params: { page, limit, module }
      });
      return data;
    },
  });
}
