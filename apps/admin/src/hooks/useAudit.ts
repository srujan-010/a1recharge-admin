import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AuditLogEntry {
  _id: string;
  adminId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  action: string;
  module: string;
  oldData?: any;
  newData?: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

interface AuditResponse {
  success: boolean;
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useAuditLogs(page = 1, limit = 50, module = 'ALL') {
  return useQuery({
    queryKey: ['audit-logs', page, limit, module],
    queryFn: async () => {
      const { data } = await api.get<AuditResponse>('/admin/audit-logs', {
        params: { page, limit, module }
      });
      return data;
    },
  });
}
