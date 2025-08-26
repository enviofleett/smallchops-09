import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrdersRequest {
  action: 'list' | 'get' | 'update' | 'delete' | 'bulk_delete';
  page?: number;
  pageSize?: number;
  status?: string;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  orderId?: string;
  orderIds?: string[];
  updates?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Use anon client to verify JWT
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await anonSupabase.auth.getUser(jwt);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    const requestBody: OrdersRequest = await req.json();
    const { action } = requestBody;

    console.log('Admin orders request:', { action, userId: user.id, userEmail: user.email });

    switch (action) {
      case 'list': {
        const { page = 1, pageSize = 10, status = 'all', searchQuery = '', startDate, endDate } = requestBody;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from('orders')
          .select(`*, 
            order_items (*),
            delivery_zones (id, name, base_fee, is_active)
          `, { count: 'exact' });

        if (status !== 'all') {
          query = query.eq('status', status);
        }

        if (searchQuery) {
          const searchString = `%${searchQuery}%`;
          query = query.or(
            `order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`
          );
        }

        // Add date filtering
        if (startDate) {
          query = query.gte('order_time', startDate + 'T00:00:00.000Z');
        }
        if (endDate) {
          query = query.lte('order_time', endDate + 'T23:59:59.999Z');
        }

        const { data, error, count } = await query
          .order('order_time', { ascending: false })
          .range(from, to);

        let orders = data || [];
        let finalCount = count || 0;

        // Fetch delivery schedules for all orders (bypassing RLS with service role)
        if (orders.length > 0) {
          const orderIds = orders.map((order: any) => order.id);
          const { data: schedules } = await supabase
            .from('order_delivery_schedule')
            .select('*')
            .in('order_id', orderIds);

          // Map schedules to orders
          const scheduleMap = new Map();
          (schedules || []).forEach((schedule: any) => {
            scheduleMap.set(schedule.order_id, schedule);
          });

          orders = orders.map((order: any) => ({
            ...order,
            delivery_schedule: scheduleMap.get(order.id) || null
          }));
        }

        // If query failed due to relationship issues, try fallback
        if (error) {
          console.warn('Main query failed, trying fallback:', error.message);
          
          let fallbackQuery = supabase
            .from('orders')
            .select(`*, order_items (*)`, { count: 'exact' });

          if (status !== 'all') {
            fallbackQuery = fallbackQuery.eq('status', status);
          }

          if (searchQuery) {
            const searchString = `%${searchQuery}%`;
            fallbackQuery = fallbackQuery.or(
              `order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`
            );
          }

          if (startDate) {
            fallbackQuery = fallbackQuery.gte('order_time', startDate + 'T00:00:00.000Z');
          }
          if (endDate) {
            fallbackQuery = fallbackQuery.lte('order_time', endDate + 'T23:59:59.999Z');
          }

          const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery
            .order('order_time', { ascending: false })
            .range(from, to);

          if (fallbackError) {
            throw fallbackError;
          }

          orders = fallbackData || [];
          finalCount = fallbackCount || 0;

          // Manually fetch delivery zones and schedules for each order
          if (orders.length > 0) {
            const orderIds = orders.map((order: any) => order.id);
            
            // Fetch delivery schedules
            const { data: schedules } = await supabase
              .from('order_delivery_schedule')
              .select('*')
              .in('order_id', orderIds);

            const scheduleMap = new Map();
            (schedules || []).forEach((schedule: any) => {
              scheduleMap.set(schedule.order_id, schedule);
            });

            const ordersWithZones = await Promise.all(
              orders.map(async (order: any) => {
                let orderWithZone = order;
                
                if (order.delivery_zone_id) {
                  try {
                    const { data: zone } = await supabase
                      .from('delivery_zones')
                      .select('id, name, base_fee, is_active')
                      .eq('id', order.delivery_zone_id)
                      .single();
                    
                    orderWithZone = { ...order, delivery_zones: zone };
                  } catch (zoneError) {
                    console.warn(`Failed to fetch zone for order ${order.id}:`, zoneError);
                    orderWithZone = { ...order, delivery_zones: null };
                  }
                } else {
                  orderWithZone = { ...order, delivery_zones: null };
                }

                // Add delivery schedule
                return {
                  ...orderWithZone,
                  delivery_schedule: scheduleMap.get(order.id) || null
                };
              })
            );
            orders = ordersWithZones;
          }
        }

        // Merge latest successful/paid transaction to compute final payment fields
        let augmented = orders;
        if (orders.length > 0) {
          const orderIds = orders.map((o: any) => o.id);
          
          // Try to fetch payment transactions with graceful fallback for missing created_at column
          let txs = null;
          try {
            const { data, error } = await supabase
              .from('payment_transactions')
              .select('id, order_id, status, paid_at, channel')
              .in('order_id', orderIds)
              .order('paid_at', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false });
            
            if (error && error.message.includes('created_at')) {
              // Fallback query without created_at ordering if column doesn't exist
              console.warn('created_at column not found in list query, using fallback:', error.message);
              const { data: fallbackData } = await supabase
                .from('payment_transactions')
                .select('id, order_id, status, paid_at, channel')
                .in('order_id', orderIds)
                .order('paid_at', { ascending: false, nullsFirst: false });
              txs = fallbackData;
            } else if (error) {
              console.warn('TX fetch warning:', error.message);
              txs = null;
            } else {
              txs = data;
            }
          } catch (err) {
            console.warn('Payment transactions list query failed:', err);
            txs = null;
          }
          
          const latestByOrder = new Map<string, any>();
          (txs || []).forEach((t: any) => {
            if (!latestByOrder.has(t.order_id) && (t.status === 'success' || t.status === 'paid')) {
              latestByOrder.set(t.order_id, t);
            }
          });
          augmented = orders.map((o: any) => {
            const tx = latestByOrder.get(o.id);
            const final_paid = o.payment_status === 'paid' || (tx && (tx.status === 'success' || tx.status === 'paid'));
            const final_paid_at = o.paid_at || (tx ? tx.paid_at : null);
            const payment_channel = tx ? tx.channel : null;
            return { ...o, final_paid, final_paid_at, payment_channel };
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          orders: augmented, 
          count: finalCount
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'get': {
        const { orderId } = requestBody;
        if (!orderId) throw new Error('Order ID required');

        const { data, error } = await supabase
          .from('orders')
          .select(`*, 
            order_items (*),
            delivery_zones (id, name, base_fee, is_active)
          `)
          .eq('id', orderId)
          .single();

        let orderData = data;

        // Fetch delivery schedule for the single order
        if (orderData) {
          const { data: schedule } = await supabase
            .from('order_delivery_schedule')
            .select('*')
            .eq('order_id', orderId)
            .maybeSingle();
          
          orderData = { ...orderData, delivery_schedule: schedule };
        }

        // If main query fails, try fallback without delivery zone relationship
        if (error) {
          console.warn('Main single order query failed, trying fallback:', error.message);
          
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('orders')
            .select(`*, order_items (*)`)
            .eq('id', orderId)
            .single();

          if (fallbackError) {
            throw fallbackError;
          }

          orderData = fallbackData;

          // Manually fetch delivery zone if needed
          if (orderData?.delivery_zone_id) {
            try {
              const { data: zone } = await supabase
                .from('delivery_zones')
                .select('id, name, base_fee, is_active')
                .eq('id', orderData.delivery_zone_id)
                .single();
              
          orderData.delivery_zones = zone;
        } catch (zoneError) {
          console.warn(`Failed to fetch zone for order ${orderId}:`, zoneError);
          orderData.delivery_zones = null;
        }
      } else {
        orderData.delivery_zones = null;
      }

      // Fetch delivery schedule for fallback case too
      const { data: schedule } = await supabase
        .from('order_delivery_schedule')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      
      orderData = { ...orderData, delivery_schedule: schedule };
        }

        // Compute final payment fields for single order
        let orderWithPayment = orderData;
        if (orderData) {
          // Try to fetch payment transactions with graceful fallback for missing created_at column
          let txs = null;
          try {
            const { data, error } = await supabase
              .from('payment_transactions')
              .select('id, order_id, status, paid_at, channel')
              .eq('order_id', orderData.id)
              .order('paid_at', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false });
            
            if (error && error.message.includes('created_at')) {
              // Fallback query without created_at ordering if column doesn't exist
              console.warn('created_at column not found, using fallback query:', error.message);
              const { data: fallbackData } = await supabase
                .from('payment_transactions')
                .select('id, order_id, status, paid_at, channel')
                .eq('order_id', orderData.id)
                .order('paid_at', { ascending: false, nullsFirst: false });
              txs = fallbackData;
            } else if (error) {
              console.warn('Payment transactions query error:', error.message);
              txs = null;
            } else {
              txs = data;
            }
          } catch (err) {
            console.warn('Payment transactions query failed:', err);
            txs = null;
          }
          
          const tx = (txs || []).find((t: any) => t.status === 'success' || t.status === 'paid') || null;
          const final_paid = orderData.payment_status === 'paid' || !!tx;
          const final_paid_at = orderData.paid_at || (tx ? tx.paid_at : null);
          const payment_channel = tx ? tx.channel : null;
          orderWithPayment = { ...orderData, final_paid, final_paid_at, payment_channel };
        }

        return new Response(JSON.stringify({ success: true, order: orderWithPayment }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'update': {
        const { orderId, updates } = requestBody;
        if (!orderId || !updates) throw new Error('Order ID and updates required');

        // Enhanced update with rider assignment validation
        let updateData = { ...updates };
        
        // If assigning a rider, validate the rider exists and get their profile_id
        if (updates.assigned_rider_id) {
          const { data: driver, error: driverError } = await supabase
            .from('drivers')
            .select('id, profile_id, is_active')
            .eq('id', updates.assigned_rider_id)
            .eq('is_active', true)
            .single();

          if (driverError || !driver) {
            // Try to find by profile_id instead (new mapping approach)
            const { data: profileCheck, error: profileCheckError } = await supabase
              .from('drivers')
              .select('id, profile_id, is_active')
              .eq('profile_id', updates.assigned_rider_id)
              .eq('is_active', true)
              .single();

            if (profileCheckError || !profileCheck) {
              throw new Error('Driver not found or inactive');
            }
            
            // Use the profile_id for assignment
            updateData.assigned_rider_id = profileCheck.profile_id;
          } else {
            // Use the profile_id from driver record
            updateData.assigned_rider_id = driver.profile_id || driver.id;
          }
        }

        // Validate status transitions
        if (updates.status === 'out_for_delivery') {
          const { data: currentOrder, error: orderError } = await supabase
            .from('orders')
            .select('assigned_rider_id, status')
            .eq('id', orderId)
            .single();

          if (orderError) throw orderError;

          if (!currentOrder.assigned_rider_id && !updateData.assigned_rider_id) {
            throw new Error('A dispatch rider must be assigned before moving to out_for_delivery');
          }
        }

        const { data, error } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId)
          .select(`*, 
            order_items (*),
            delivery_zones (id, name, base_fee, is_active)
          `)
          .single();

        let updatedOrder = data;

        // If update with relationship fails, try fallback
        if (error) {
          console.warn('Update with delivery zone failed, trying fallback:', error.message);
          
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .select(`*, order_items (*)`)
            .single();

          if (fallbackError) {
            throw fallbackError;
          }

          updatedOrder = fallbackData;

          // Manually fetch delivery zone
          if (updatedOrder?.delivery_zone_id) {
            try {
              const { data: zone } = await supabase
                .from('delivery_zones')
                .select('id, name, base_fee, is_active')
                .eq('id', updatedOrder.delivery_zone_id)
                .single();
              
              updatedOrder.delivery_zones = zone;
            } catch (zoneError) {
              console.warn(`Failed to fetch zone for updated order ${orderId}:`, zoneError);
              updatedOrder.delivery_zones = null;
            }
          } else {
            updatedOrder.delivery_zones = null;
          }
        }

        return new Response(JSON.stringify({ success: true, order: updatedOrder }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'delete': {
        const { orderId } = requestBody;
        if (!orderId) throw new Error('Order ID required');

        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'bulk_delete': {
        const { orderIds } = requestBody;
        if (!orderIds || !Array.isArray(orderIds)) throw new Error('Order IDs array required');

        const { error } = await supabase
          .from('orders')
          .delete()
          .in('id', orderIds);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      default:
        throw new Error('Invalid action');
    }

  } catch (error: any) {
    console.error('Error in admin-orders-manager:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);