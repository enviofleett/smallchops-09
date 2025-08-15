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
            delivery_zones (id, name, description)
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

        if (error) throw error;

        // Merge latest successful/paid transaction to compute final payment fields
        const orders = data || [];
        let augmented = orders;
        if (orders.length > 0) {
          const orderIds = orders.map((o: any) => o.id);
          const { data: txs, error: txError } = await supabase
            .from('payment_transactions')
            .select('id, order_id, status, paid_at, channel')
            .in('order_id', orderIds)
            .order('paid_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });
          if (txError) console.warn('TX fetch warning:', txError.message);
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
          count: count || 0 
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
            delivery_zones (id, name, description)
          `)
          .eq('id', orderId)
          .single();

        if (error) throw error;

        // Compute final payment fields for single order
        let orderWithPayment = data;
        if (data) {
          const { data: txs } = await supabase
            .from('payment_transactions')
            .select('id, order_id, status, paid_at, channel')
            .eq('order_id', data.id)
            .order('paid_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });
          const tx = (txs || []).find((t: any) => t.status === 'success' || t.status === 'paid') || null;
          const final_paid = data.payment_status === 'paid' || !!tx;
          const final_paid_at = data.paid_at || (tx ? tx.paid_at : null);
          const payment_channel = tx ? tx.channel : null;
          orderWithPayment = { ...data, final_paid, final_paid_at, payment_channel };
        }

        return new Response(JSON.stringify({ success: true, order: orderWithPayment }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'update': {
        const { orderId, updates } = requestBody;
        if (!orderId || !updates) throw new Error('Order ID and updates required');

        const { data, error } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', orderId)
          .select(`*, 
            order_items (*),
            delivery_zones (id, name, description)
          `)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, order: data }), {
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