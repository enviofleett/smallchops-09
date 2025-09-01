import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'order-history': {
        if (req.method !== 'GET') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        const customerEmail = url.searchParams.get('email');
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const status = url.searchParams.get('status');
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        if (!customerEmail) {
          return new Response(
            JSON.stringify({ error: 'Customer email is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let query = supabase
          .from('orders')
          .select(`
            *,
            order_items (
              *,
              products:product_id (name, image_url)
            )
          `)
          .eq('customer_email', customerEmail);

        // Apply filters
        if (status) query = query.eq('status', status);
        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);

        // Pagination
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

        const { data: orders, error, count } = await query;

        if (error) throw error;

        // Get total count for pagination
        let countQuery = supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('customer_email', customerEmail);

        if (status) countQuery = countQuery.eq('status', status);
        if (startDate) countQuery = countQuery.gte('created_at', startDate);
        if (endDate) countQuery = countQuery.lte('created_at', endDate);

        const { count: totalCount } = await countQuery;

        return new Response(JSON.stringify({
          orders,
          pagination: {
            page,
            limit,
            total: totalCount || 0,
            totalPages: Math.ceil((totalCount || 0) / limit)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'modify-order': {
        if (req.method !== 'POST') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        const { orderId, modificationType, newData, reason } = await req.json();

        if (!orderId || !modificationType) {
          return new Response(
            JSON.stringify({ error: 'Order ID and modification type are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ error: 'Order not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if modification is allowed based on order status
        const allowedModifications = {
          'pending': ['cancel', 'modify_items', 'change_address'],
          'confirmed': ['cancel', 'change_address'],
          'preparing': ['cancel'],
          'ready': [],
          'out_for_delivery': [],
          'delivered': ['return'],
          'cancelled': [],
          'refunded': []
        };

        const allowed = allowedModifications[order.status as keyof typeof allowedModifications] || [];
        
        if (!allowed.includes(modificationType)) {
          return new Response(
            JSON.stringify({ 
              error: 'Modification not allowed',
              message: `Cannot ${modificationType} order in ${order.status} status`
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create modification record
        const { data: modification, error: modError } = await supabase
          .from('order_modifications')
          .insert({
            order_id: orderId,
            modification_type: modificationType,
            original_data: order,
            new_data: newData,
            reason: reason
          })
          .select()
          .single();

        if (modError) throw modError;

        // Process specific modifications
        let response: any = { modification };

        switch (modificationType) {
          case 'cancel': {
            // Update order status
            await supabase
              .from('orders')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() })
              .eq('id', orderId);

            // Initiate refund if payment was made
            if (order.payment_status === 'paid') {
              await supabase.functions.invoke('refund-management', {
                body: {
                  orderId,
                  amount: order.total_amount,
                  reason: 'Customer requested cancellation'
                }
              });
            }

            response.message = 'Order cancelled successfully';
            break;
          }

          case 'change_address': {
            if (newData?.delivery_address) {
              await supabase
                .from('orders')
                .update({ 
                  delivery_address: newData.delivery_address,
                  updated_at: new Date().toISOString()
                })
                .eq('id', orderId);
              
              response.message = 'Delivery address updated successfully';
            }
            break;
          }

          case 'modify_items': {
            // This would require complex inventory and pricing recalculation
            response.message = 'Item modification request submitted for review';
            break;
          }
        }

        // Mark modification as processed
        await supabase
          .from('order_modifications')
          .update({ 
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('id', modification.id);

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'tracking': {
        if (req.method === 'GET') {
          const orderId = url.searchParams.get('orderId');
          
          if (!orderId) {
            return new Response(
              JSON.stringify({ error: 'Order ID is required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: tracking, error } = await supabase
            .from('delivery_tracking')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return new Response(JSON.stringify(tracking), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (req.method === 'POST') {
          const { orderId, status, location, estimatedArrival, driverInfo, notes } = await req.json();

          const { data: tracking, error } = await supabase
            .from('delivery_tracking')
            .insert({
              order_id: orderId,
              status,
              location,
              estimated_arrival: estimatedArrival,
              driver_info: driverInfo,
              notes
            })
            .select()
            .single();

          if (error) throw error;

          // Send real-time notification to customer via unified SMTP
          await supabase.functions.invoke('unified-smtp-sender', {
            headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
            body: {
              templateId: 'delivery_update',
              recipient: {
                email: tracking.order_id, // This should be resolved to customer email
                name: 'Customer'
              },
              variables: {
                orderNumber: tracking.order_id,
                status,
                estimatedArrival,
                trackingUrl: `https://yourapp.com/track/${orderId}`
              },
              emailType: 'transactional'
            }
          });

          return new Response(JSON.stringify(tracking), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      }

      case 'notification-preferences': {
        if (req.method === 'GET') {
          const customerId = url.searchParams.get('customerId');
          
          if (!customerId) {
            return new Response(
              JSON.stringify({ error: 'Customer ID is required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: channels, error } = await supabase
            .from('customer_notification_channels')
            .select('*')
            .eq('customer_id', customerId);

          if (error) throw error;

          return new Response(JSON.stringify(channels), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (req.method === 'POST') {
          const { customerId, channelType, channelValue, preferences } = await req.json();

          const { data: channel, error } = await supabase
            .from('customer_notification_channels')
            .upsert({
              customer_id: customerId,
              channel_type: channelType,
              channel_value: channelValue,
              preferences: preferences || {}
            })
            .select()
            .single();

          if (error) throw error;

          return new Response(JSON.stringify(channel), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      }

      default: {
        return new Response(
          JSON.stringify({ error: 'Endpoint not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error) {
    console.error('Customer experience error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});