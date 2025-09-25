import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DetailedOrderData {
  order: any;
  items: any[];
  delivery_schedule?: any;
  pickup_point?: any;
  business_settings?: any;
  fulfillment_info?: {
    type: 'pickup' | 'delivery';
    booking_window?: string;
    delivery_hours?: {
      start: string;
      end: string;
      is_flexible: boolean;
    };
    address?: string;
    special_instructions?: string;
    requested_at?: string;
    business_hours?: any;
  };
}

export const useDetailedOrderData = (orderId: string) => {
  return useQuery({
    queryKey: ['detailed-order', orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      // Check if orderId is a UUID or an order number
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId);
      
      try {
        // If it's a UUID, try the comprehensive fulfillment function first
        if (isUuid) {
          const { data: comprehensiveData, error: comprehensiveError } = await supabase.rpc('get_comprehensive_order_fulfillment', {
            p_order_id: orderId
          });

          if (!comprehensiveError && comprehensiveData && !(comprehensiveData as any).error) {
            console.log('✅ Comprehensive fulfillment data loaded:', {
              hasOrder: !!(comprehensiveData as any).order,
              hasItems: !!(comprehensiveData as any).items,
              hasDeliverySchedule: !!(comprehensiveData as any).delivery_schedule,
              hasPickupPoint: !!(comprehensiveData as any).pickup_point,
              hasFulfillmentInfo: !!(comprehensiveData as any).fulfillment_info
            });
            
            const data = comprehensiveData as any;
            return {
              order: data.order,
              items: data.items || [],
              delivery_schedule: data.delivery_schedule,
              pickup_point: data.pickup_point,
              business_settings: data.business_settings,
              fulfillment_info: data.fulfillment_info
            } as DetailedOrderData;
          }

          // Fallback to original RPC function
          const { data, error } = await supabase.rpc('get_detailed_order_with_products', {
            p_order_id: orderId
          });

          if (error) {
            // Only log in development
            if (process.env.NODE_ENV === 'development') {
              console.warn('RPC error, using fallback query:', error);
            }
            throw error; // This will trigger the fallback
          }
          
          if (data && typeof data === 'object' && 'error' in data) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('RPC returned error, using fallback query:', data.error);
            }
            throw new Error(data.error as string);
          }

          if (data) {
            // Handle new RPC response format: { order: {}, items: [], delivery_schedule: {} }
            if (data && typeof data === 'object' && 'order' in data) {
              console.log('✅ RPC order data structure:', {
                hasOrder: !!data.order,
                hasItems: !!data.items,
                hasDeliverySchedule: !!data.delivery_schedule,
                itemsCount: Array.isArray(data.items) ? data.items.length : 0,
                scheduleData: data.delivery_schedule // Add actual schedule data for debugging
              });
              
              return {
                order: data.order,
                items: data.items || [],
                delivery_schedule: data.delivery_schedule
              } as DetailedOrderData;
            }
            
            // Fallback for legacy format (if needed)
            const orderData = Array.isArray(data) ? data[0] : data;
            if (orderData) {
              return {
                order: orderData,
                items: (orderData as any).order_items || [],
                delivery_schedule: (orderData as any).order_delivery_schedule
              } as DetailedOrderData;
            }
          }
        } else {
          // If it's an order number, skip RPC and go directly to fallback
          throw new Error('Order number provided, using fallback query');
        }
      } catch (rpcError) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('RPC failed, trying fallback query:', rpcError);
        }
        
        // Fallback: Separate queries with better error handling
        try {
          // Choose the correct query based on whether we have UUID or order number
          const query = supabase
            .from('orders')
            .select(`
              *,
              order_items (
                *,
                products (
                  id,
                  name,
                  description,
                  price,
                  image_url,
                  category_id,
                  features,
                  ingredients
                )
              ),
              order_delivery_schedule (*)
            `);
            
          const { data: orderData, error: orderError } = isUuid 
            ? await query.eq('id', orderId).maybeSingle()
            : await query.eq('order_number', orderId).maybeSingle();

          if (orderError) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Fallback query error:', orderError);
            }
            throw new Error(`Failed to fetch order details: ${orderError.message}`);
          }

          if (!orderData) {
            throw new Error('Order not found');
          }

          // Separate query for delivery schedule (non-critical)
          let deliverySchedule = null;
          try {
            const { data: scheduleData } = isUuid
              ? await supabase
                  .from('order_delivery_schedule')
                  .select('*')
                  .eq('order_id', orderId)
                  .maybeSingle()
              : await supabase
                  .from('order_delivery_schedule')
                  .select('*')
                  .eq('order_id', orderData.id)
                  .maybeSingle();
            
            deliverySchedule = scheduleData;
          } catch (scheduleError) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Could not fetch delivery schedule:', scheduleError);
            }
            // Continue without schedule - not critical
          }

          // Transform to expected format with normalized product data
          const normalizedItems = (orderData.order_items || []).map((item: any) => ({
            ...item,
            product: item.products ? {
              ...item.products,
              images: item.products.image_url ? [item.products.image_url] : []
            } : null
          }));

          // Priority order: separate query > joined data > fallback
          const finalSchedule = deliverySchedule || (orderData as any).order_delivery_schedule;
          
          console.log('✅ Fallback query schedule resolution:', {
            separateQuerySchedule: !!deliverySchedule,
            joinedSchedule: !!(orderData as any).order_delivery_schedule,
            finalSchedule: !!finalSchedule,
            scheduleData: finalSchedule
          });

          return {
            order: orderData,
            items: normalizedItems,
            delivery_schedule: finalSchedule
          } as DetailedOrderData;
        } catch (fallbackError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Both RPC and fallback queries failed:', fallbackError);
          }
          throw fallbackError;
        }
      }

      throw new Error('No data returned from server');
    },
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Retry up to 2 times for network errors, but not for "not found" errors
      if (failureCount >= 2) return false;
      if (error instanceof Error && error.message.includes('not found')) return false;
      return true;
    },
    gcTime: 1000 * 60 * 10 // Keep data in cache for 10 minutes
  });
};