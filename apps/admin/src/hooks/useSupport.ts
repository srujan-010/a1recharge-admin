import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ChatMessage {
  _id: string;
  senderType: 'RETAILER' | 'ADMIN' | 'SYSTEM';
  senderId?: string;
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  _id: string;
  ticketId: string;
  userId: {
    _id: string;
    retailerId: string;
    phone: string;
    fullName?: string;
    name?: string;
  };
  transactionId?: {
    _id: string;
    transactionId: string;
    amountPaise: number;
    service: string;
    status: string;
  };
  subject: string;
  category: 'TRANSACTION_FAILURE' | 'WALLET_ISSUE' | 'KYC_ISSUE' | 'COMMISSION_ISSUE' | 'OTHER';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export function useSupportTickets(page = 1, limit = 20, status = 'OPEN') {
  return useQuery({
    queryKey: ['support-tickets', page, limit, status],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: SupportTicket[] }>('/admin/support/tickets', {
        params: { page, limit, status }
      });
      return data.data;
    },
    refetchInterval: 10000, // Poll every 10s for new chat messages
  });
}

export function useReplyToTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const idempotencyKey = `reply_${id}_${Date.now()}`;
      const { data } = await api.post(
        `/admin/support/tickets/${id}/reply`,
        { message },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });
}

export function useResolveTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'RESOLVED' | 'CLOSED' }) => {
      const { data } = await api.put(`/admin/support/tickets/${id}/resolve`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });
}
