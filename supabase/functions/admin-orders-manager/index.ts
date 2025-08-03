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
        const { page = 1, pageSize = 10, status = 'all', searchQuery = '' } = requestBody;
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

        const { data, error, count } = await query
          .order('order_time', { ascending: false })
          .range(from, to);

        if (error) throw error;

        return new Response(JSON.stringify({ 
          success: true, 
          orders: data || [], 
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

        return new Response(JSON.stringify({ success: true, order: data }), {
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