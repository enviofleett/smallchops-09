import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: {
    id: string;
    name: string;
    image_url?: string;
    category?: string;
  };
}

interface CustomerOrder {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  delivery_address?: any; // Support JSON type from Supabase
  order_items: OrderItem[];
}

export const useCustomerOrdersFixed = (customerEmail?: string) => {
  return useQuery({
    queryKey: ['customer-orders-fixed', customerEmail],
    queryFn: async (): Promise<CustomerOrder[]> => {
      if (!customerEmail) {
        console.log('No customer email provided');
        return [];
      }

      console.log('Fetching orders for email:', customerEmail);

      try {
        // Use the new safe function that handles the p.images issue
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            total_amount,
            status,
            payment_status,
            created_at,
            delivery_address,
            customer_email,
            order_items (
              id,
              product_name,
              quantity,
              unit_price,
              total_price,
              product_id,
              products (
                id,
                name,
                image_url
              )
            )
          `)
          .eq('customer_email', customerEmail.toLowerCase())
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Database error fetching orders:', error);
          throw new Error(`Failed to fetch orders: ${error.message}`);
        }

        console.log(`Successfully fetched ${orders?.length || 0} orders`);
        
        // Transform the data to handle the nested products relationship safely
        const transformedOrders = orders?.map(order => ({
          ...order,
          order_items: order.order_items?.map(item => ({
            ...item,
            product: item.products || undefined
          })) || []
        })) || [];

        return transformedOrders;

      } catch (error) {
        console.error('Error in useCustomerOrdersFixed:', error);
        
        // Fallback: try to get basic order data without product details
        try {
          const { data: basicOrders, error: basicError } = await supabase
            .from('orders')
            .select(`
              id,
              order_number,
              total_amount,
              status,
              payment_status,
              created_at,
              delivery_address,
              order_items (
                id,
                product_name,
                quantity,
                unit_price,
                total_price
              )
            `)
            .eq('customer_email', customerEmail.toLowerCase())
            .order('created_at', { ascending: false });

          if (basicError) {
            throw basicError;
          }

          console.log('Fallback query successful, returning basic order data');
          return basicOrders || [];
          
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          throw error; // Throw original error
        }
      }
    },
    enabled: !!customerEmail,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes (renamed from cacheTime in newer versions)
    retry: (failureCount, error) => {
      // Only retry on network errors, not on permission errors
      const isRetryableError = !error.message.includes('permission') && 
                              !error.message.includes('policy') &&
                              failureCount < 2;
      
      console.log(`Query retry attempt ${failureCount}, will retry: ${isRetryableError}`);
      return isRetryableError;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000)
  });
};