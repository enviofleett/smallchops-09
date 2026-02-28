import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
  }
  
  const corsHeaders = getCorsHeaders(origin);

  try {
    // 🔒 SECURITY: Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 🔒 Verify admin role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('role', ['super_admin', 'store_owner', 'admin'])
      .limit(1);

    if (!roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('✅ Admin verified:', user.email);

    const body = await req.json();
    const { items, customer, fulfillment, delivery_schedule } = body;

    // Validate required fields
    if (!items?.length) throw new Error('No items provided');
    if (!customer?.email) throw new Error('Customer email is required');
    if (!customer?.name) throw new Error('Customer name is required');
    if (!customer?.phone) throw new Error('Customer phone is required');

    // Calculate amounts
    const subtotal = items.reduce((sum: number, item: any) => 
      sum + ((item.unit_price || item.price) * item.quantity), 0);
    const deliveryFee = fulfillment?.type === 'delivery' ? (fulfillment.delivery_fee || 0) : 0;
    const totalAmount = subtotal + deliveryFee;

    // Generate order identifiers
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const orderNumber = `ORD-${timestamp}-${randomId}`;
    const orderId = crypto.randomUUID();
    const orderTime = new Date().toISOString();

    console.log('📦 Creating admin order:', { orderNumber, totalAmount, customerEmail: customer.email });

    // Create order in database
    const orderData = {
      id: orderId,
      order_number: orderNumber,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      order_type: fulfillment?.type === 'pickup' ? 'pickup' : 'delivery',
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'bank_transfer',
      subtotal,
      tax_amount: 0,
      delivery_fee: deliveryFee,
      transaction_fee: 0,
      total_amount: totalAmount,
      payment_reference: `admin_${timestamp}_${randomId}`,
      pickup_point_id: fulfillment?.pickup_point_id || null,
      delivery_address: fulfillment?.type === 'delivery' ? {
        address: fulfillment.address?.address_line_1 || '',
        location: fulfillment.address?.city || '',
        zone_id: fulfillment.delivery_zone_id || null
      } : null,
      delivery_zone_id: fulfillment?.delivery_zone_id || null,
      delivery_date: delivery_schedule?.delivery_date || null,
      special_instructions: delivery_schedule?.special_instructions || '',
      created_by: user.id,
      order_time: orderTime,
      created_at: orderTime,
      updated_at: orderTime
    };

    const { data: orderResult, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('❌ Order creation error:', orderError);
      throw new Error(`Order creation failed: ${orderError.message}`);
    }

    console.log('✅ Order created:', orderResult.order_number);

    // Create order items
    const orderItemsData = items.map((item: any) => ({
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name || item.name,
      quantity: item.quantity,
      unit_price: item.unit_price || item.price,
      total_price: (item.unit_price || item.price) * item.quantity,
      customizations: item.customizations || null,
      created_at: orderTime,
      updated_at: orderTime
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);
    if (itemsError) {
      await supabase.from('orders').delete().eq('id', orderId);
      throw new Error(`Order items creation failed: ${itemsError.message}`);
    }

    // Save delivery schedule if provided
    if (delivery_schedule?.delivery_date) {
      const { error: scheduleError } = await supabase.from('delivery_schedules').insert({
        order_id: orderId,
        delivery_date: delivery_schedule.delivery_date,
        delivery_time_start: delivery_schedule.delivery_time_start || '09:00',
        delivery_time_end: delivery_schedule.delivery_time_end || '17:00',
        status: 'scheduled'
      });
      if (scheduleError) {
        console.error('⚠️ Delivery schedule insert failed:', scheduleError.message);
      }
    }

    // 💳 Create Paystack customer and DVA
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    let virtualAccount = null;

    if (PAYSTACK_SECRET_KEY) {
      try {
        // Step 1: Create or fetch Paystack customer
        const nameParts = customer.name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || firstName;

        console.log('💳 Creating Paystack customer...');
        const customerRes = await fetch('https://api.paystack.co/customer', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: customer.email,
            first_name: firstName,
            last_name: lastName,
            phone: customer.phone
          })
        });

        const customerData = await customerRes.json();
        console.log('💳 Paystack customer response:', customerData.status);

        if (customerData.status && customerData.data?.customer_code) {
          const customerCode = customerData.data.customer_code;

          // Step 2: Create Dedicated Virtual Account
          console.log('🏦 Creating DVA for customer:', customerCode);
          const dvaRes = await fetch('https://api.paystack.co/dedicated_account', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              customer: customerCode,
              preferred_bank: 'wema-bank'
            })
          });

          const dvaData = await dvaRes.json();
          console.log('🏦 DVA response:', dvaData.status, dvaData.message);

          if (dvaData.status && dvaData.data?.dedicated_account) {
            const dva = dvaData.data.dedicated_account;
            virtualAccount = {
              account_number: dva.account_number,
              bank_name: dva.bank?.name || 'Wema Bank',
              account_name: dva.account_name || customer.name,
              provider_reference: customerCode
            };

            // Store virtual account details
            await supabase.from('order_payment_accounts').insert({
              order_id: orderId,
              account_number: virtualAccount.account_number,
              bank_name: virtualAccount.bank_name,
              account_name: virtualAccount.account_name,
              provider: 'paystack',
              provider_reference: customerCode,
              is_active: true
            });

            console.log('✅ Virtual account created:', virtualAccount.account_number);
          } else {
            console.warn('⚠️ DVA creation failed:', dvaData.message);
            // DVA failed but order is still created - admin can retry or provide account manually
          }
        }
      } catch (paystackError) {
        console.error('❌ Paystack DVA error:', paystackError);
        // Don't fail the order - DVA is optional
      }
    }

    // 📧 Queue email notification
    try {
      await supabase.from('communication_events').insert({
        event_type: 'admin_order_invoice',
        order_id: orderId,
        status: 'queued',
        metadata: {
          customer_email: customer.email,
          customer_name: customer.name,
          order_number: orderNumber,
          total_amount: totalAmount,
          virtual_account: virtualAccount,
          items: items.map((item: any) => ({
            name: item.product_name || item.name,
            quantity: item.quantity,
            price: item.unit_price || item.price
          })),
          delivery_schedule: delivery_schedule,
          fulfillment_type: fulfillment?.type
        }
      });
      console.log('📧 Email notification queued');
    } catch (emailError) {
      console.warn('⚠️ Email queue failed:', emailError);
    }

    return new Response(JSON.stringify({
      success: true,
      order: {
        id: orderId,
        order_number: orderNumber,
        total_amount: totalAmount,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'bank_transfer',
        customer_name: customer.name,
        customer_email: customer.email,
        items_count: items.length,
        created_at: orderTime
      },
      virtual_account: virtualAccount,
      message: virtualAccount 
        ? 'Order created with virtual account for bank transfer payment'
        : 'Order created. Virtual account generation pending.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('❌ Admin create order failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to create order'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
