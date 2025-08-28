import { useQuery } from '@tanstack/react-query';
import { getOrders, OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';

interface OrderQueryParams {
  filters: {
    status: OrderStatus | 'all';
    searchQuery: string;
    startDate?: string;
    endDate?: string;
  };
  pagination?: {
    page: number;
    pageSize: number;
  };
}

export const useOrdersQuery = ({
  filters,
  pagination = { page: 1, pageSize: 50 }
}: OrderQueryParams) => {
  return useQuery({
    queryKey: ['orders', filters, pagination],
    queryFn: () => getOrders({
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: filters.status,
      searchQuery: filters.searchQuery,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
    refetchOnWindowFocus: false,
    retry: 2,
  });
};