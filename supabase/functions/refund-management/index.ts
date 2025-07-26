import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface RefundRequest {
  action: 'create_refund' | 'get_refunds' | 'update_refund_status';
  transactionId?: string;
  amount?: number;
  reason?: string;
  refundId?: string;
  status?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestData: RefundRequest = await req.json();

    switch (requestData.action) {
      case 'create_refund':
        return await createRefund(supabaseClient, requestData, user.id);
      case 'get_refunds':
        return await getRefunds(supabaseClient);
      case 'update_refund_status':
        return await updateRefundStatus(supabaseClient, requestData, user.id);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Refund management error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function createRefund(supabaseClient: any, data: RefundRequest, adminId: string) {
  try {
    const { transactionId, amount, reason } = data;

    if (!transactionId || !amount || !reason) {
      throw new Error('Transaction ID, amount, and reason are required');
    }

    // Get the original transaction
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (transactionError || !transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'success') {
      throw new Error('Can only refund successful transactions');
    }

    if (amount > parseFloat(transaction.amount)) {
      throw new Error('Refund amount cannot exceed transaction amount');
    }

    // Get Paystack configuration
    const { data: config, error: configError } = await supabaseClient
      .from('payment_integrations')
      .select('secret_key')
      .eq('provider', 'paystack')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Paystack configuration not found');
    }

    // Create refund with Paystack
    const refundResponse = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secret_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: transaction.provider_reference,
        amount: Math.round(amount * 100), // Convert to kobo
        reason: reason
      })
    });

    const refundData = await refundResponse.json();

    if (!refundData.status) {
      throw new Error(refundData.message || 'Failed to create refund with Paystack');
    }

    // Create refund record in database
    const refundId = crypto.randomUUID();
    const { data: refund, error: refundError } = await supabaseClient
      .from('payment_refunds')
      .insert({
        id: refundId,
        transaction_id: transactionId,
        amount: amount,
        reason: reason,
        status: 'pending',
        provider_refund_id: refundData.data.id,
        created_by: adminId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (refundError) {
      throw new Error('Failed to create refund record');
    }

    // Log the refund action
    await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: adminId,
        action: 'CREATE_REFUND',
        category: 'Payment',
        entity_type: 'refund',
        entity_id: refundId,
        message: `Refund of ${amount} created for transaction ${transactionId}`,
        new_values: { refund_id: refundId, amount, reason }
      });

    return new Response(JSON.stringify({
      status: true,
      data: {
        refund_id: refundId,
        transaction_id: transactionId,
        amount: amount,
        status: 'pending',
        provider_refund_id: refundData.data.id
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Create refund error:', error);
    return new Response(JSON.stringify({ 
      status: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getRefunds(supabaseClient: any) {
  try {
    const { data: refunds, error } = await supabaseClient
      .from('payment_refunds')
      .select(`
        *,
        payment_transactions(
          provider_reference,
          customer_email,
          amount as original_amount,
          created_at as transaction_date
        ),
        profiles(name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch refunds');
    }

    return new Response(JSON.stringify({
      status: true,
      data: refunds
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      status: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function updateRefundStatus(supabaseClient: any, data: RefundRequest, adminId: string) {
  try {
    const { refundId, status } = data;

    if (!refundId || !status) {
      throw new Error('Refund ID and status are required');
    }

    const { data: refund, error } = await supabaseClient
      .from('payment_refunds')
      .update({
        status: status,
        updated_at: new Date().toISOString(),
        updated_by: adminId
      })
      .eq('id', refundId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update refund status');
    }

    // Log the status update
    await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: adminId,
        action: 'UPDATE_REFUND_STATUS',
        category: 'Payment',
        entity_type: 'refund',
        entity_id: refundId,
        message: `Refund status updated to ${status}`,
        new_values: { status }
      });

    return new Response(JSON.stringify({
      status: true,
      data: refund
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      status: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}