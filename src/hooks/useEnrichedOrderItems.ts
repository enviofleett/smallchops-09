import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EnrichedOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  vat_amount?: number;
  vat_rate?: number;
  discount_amount?: number;
  special_instructions?: string;
  customizations?: any;
  product?: {
    id: string;
    name: string;
    description?: string;
    features?: string[] | string;
    ingredients?: string;
    image_url?: string;
    category_id?: string;
  };
  features?: string[] | string;
}

/**
 * Hook to enrich order items with product data, ensuring features and images are available
 */
export const useEnrichedOrderItems = (orderItems: any[]) => {
  return useQuery({
    queryKey: ['enriched-order-items', orderItems?.map(item => item.product_id).join(',')],
    queryFn: async () => {
      if (!orderItems?.length) return [];

      const productIds = orderItems.map(item => item.product_id).filter(Boolean);
      
      if (productIds.length === 0) return orderItems;

      try {
        // Fetch product details for all items
        const { data: products, error } = await supabase
          .from('products')
          .select('id, name, description, features, ingredients, image_url, category_id')
          .in('id', productIds);

        if (error) {
          console.warn('Failed to fetch product details for enrichment:', error);
          return orderItems;
        }

        // Create a product lookup map
        const productMap = new Map(products?.map(p => [p.id, p]) || []);

        // Enrich order items with product data
        const enrichedItems: EnrichedOrderItem[] = orderItems.map(item => ({
          ...item,
          product: productMap.get(item.product_id) || item.product
        }));

        return enrichedItems;
      } catch (error) {
        console.warn('Error enriching order items:', error);
        return orderItems;
      }
    },
    enabled: !!orderItems?.length,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false
  });
};