import { supabase } from '@/integrations/supabase/client';

export interface PublicProductsParams {
  category_id?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface PublicProductsResponse {
  products: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const getPublicProducts = async (params: PublicProductsParams = {}): Promise<PublicProductsResponse> => {
  try {
    const { category_id, page = 1, limit = 20, search } = params;
    
    // Use the edge function for public products
    const { data, error } = await supabase.functions.invoke('get-public-products', {
      body: { 
        category_id: category_id && category_id !== 'all' ? category_id : undefined,
        page,
        limit,
        q: search
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Error fetching public products:', error);
    throw error;
  }
};