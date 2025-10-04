import { useQuery } from '@tanstack/react-query';
import { getOrders, OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';

interface OrderQueryParams {
  filters: {
    status: OrderStatus | 'all';
    searchQuery: string;
    startDate?: string;
    endDate?: string;
    deliveryDate?: string;
    deliveryHour?: number;
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
      status: filters.status === 'all' ? undefined : filters.status,
      searchQuery: filters.searchQuery || undefined,
      startDate: filters.startDate,
      endDate: filters.endDate,
      deliveryDate: filters.deliveryDate,
      deliveryHour: filters.deliveryHour,
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
    refetchOnWindowFocus: false,
    retry: 2,
  });
};