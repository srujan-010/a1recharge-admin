import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface KycRecord {
  _id: string;
  userId: string;
  user?: {
    _id: string;
    retailerId: string;
    phone: string;
    email: string;
  };
  fullName: string;
  dob: string;
  address: string;
  aadhaarNumber: string;
  panNumber: string;
  gstNumber: string;
  shopName: string;
  businessType: string;
  aadhaarFront: string;
  aadhaarBack: string;
  panImage: string;
  shopPhoto: string;
  selfie: string;
  status: 'notStarted' | 'pending' | 'verified' | 'rejected' | 'underReview';
  remarks: string;
  submittedAt: string;
  approvedAt: string;
  rejectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface KycResponse {
  success: boolean;
  data: KycRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useKycList(page = 1, limit = 20, search = '', status = 'pending') {
  return useQuery({
    queryKey: ['kyc-list', page, limit, search, status],
    queryFn: async () => {
      const { data } = await api.get<KycResponse>('/admin/kyc', {
        params: { page, limit, search, status }
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useUpdateKycStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      remarks
    }: {
      id: string;
      status: 'verified' | 'rejected';
      remarks?: string;
    }) => {
      const { data } = await api.put(
        `/admin/kyc/${id}/status`,
        { status, remarks }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-list'] });
    },
  });
}
