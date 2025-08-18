
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProductsQueryParams {
  categoryId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface PaginatedProductsResponse {
  products: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  timestamp: string;
}

export const useOptimizedProducts = (params: ProductsQueryParams = {}) => {
  const { categoryId = 'all', page = 1, limit = 20, search } = params;

  return useQuery({
    queryKey: ['optimized-products', categoryId, page, limit, search],
    queryFn: async (): Promise<PaginatedProductsResponse> => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (categoryId !== 'all') {
        searchParams.set('category_id', categoryId);
      }

      if (search) {
        searchParams.set('q', search);
      }

      const { data, error } = await supabase.functions.invoke('get-public-products', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: null,
      });

      if (error) {
        console.error('Products fetch error:', error);
        throw new Error(`Failed to fetch products: ${error.message}`);
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Smooth pagination
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
