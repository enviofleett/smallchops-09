import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReconcileRequest {
  action: 'check_health' | 'reconcile_all' | 'reconcile_order' | 'reconcile_batch' | 'force_confirm';
  order_id?: string;
  reference?: string;
  batch_limit?: number;
}

interface ReconcileResponse {
  success: boolean;
  data?: any;
  message: string;
  timestamp: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify admin access
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new Error('Unauthorized');
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin using your existing is_admin() function
    const { data: adminCheck, error: adminError } = await supabase
      .rpc('is_admin');

    if (adminError || !adminCheck) {
      throw new Error('Admin access required');
    }

    const requestData: ReconcileRequest = await req.json();
    let response: ReconcileResponse;

    switch (requestData.action) {
      case 'check_health':
        response = await checkSystemHealth(supabase);
        break;
        
      case 'reconcile_all':
        response = await reconcileAllPayments(supabase);
        break;

      case 'reconcile_batch':
        response = await reconcileBatchPayments(supabase, requestData.batch_limit || 100);
        break;
        
      case 'reconcile_order':
        if (!requestData.order_id) {
          throw new Error('order_id required for reconcile_order action');
        }
        response = await reconcileSpecificOrder(supabase, requestData.order_id);
        break;
        
      case 'force_confirm':
        if (!requestData.reference) {
          throw new Error('reference required for force_confirm action');
        }
        response = await forceConfirmByReference(supabase, requestData.reference);
        break;
        
      default:
        throw new Error('Invalid action');
    }

    return new Response(JSON.stringify(response), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });

  } catch (error: any) {
    console.error('Payment reconciliation error:', error);
    
    const errorResponse: ReconcileResponse = {
      success: false,
      message: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse), {
      status: error.message === 'Unauthorized' || error.message === 'Admin access required' ? 403 : 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });
  }
});

async function checkSystemHealth(supabase: any): Promise<ReconcileResponse> {
  const { data: dashboardStats, error } = await supabase
    .rpc('get_payment_dashboard_stats');

  if (error) {
    throw error;
  }

  return {
    success: true,
    data: dashboardStats,
    message: 'System health check completed',
    timestamp: new Date().toISOString()
  };
}

async function reconcileAllPayments(supabase: any): Promise<ReconcileResponse> {
  // Use batch reconciliation with a reasonable limit
  const { data: batchResults, error } = await supabase
    .rpc('reconcile_payment_status_batch', { p_limit: 500 });

  if (error) {
    throw error;
  }

  const result = batchResults?.[0];

  return {
    success: true,
    data: {
      orders_processed: result?.orders_processed || 0,
      orders_updated: result?.orders_updated || 0,
      processing_time_ms: result?.processing_time_ms || 0
    },
    message: `Processed ${result?.orders_processed || 0} orders, updated ${result?.orders_updated || 0} orders`,
    timestamp: new Date().toISOString()
  };
}

async function reconcileBatchPayments(supabase: any, batchLimit: number): Promise<ReconcileResponse> {
  const { data: batchResults, error } = await supabase
    .rpc('reconcile_payment_status_batch', { p_limit: batchLimit });

  if (error) {
    throw error;
  }

  const result = batchResults?.[0];

  return {
    success: true,
    data: {
      orders_processed: result?.orders_processed || 0,
      orders_updated: result?.orders_updated || 0,
      processing_time_ms: result?.processing_time_ms || 0,
      batch_limit: batchLimit
    },
    message: `Batch processed ${result?.orders_processed || 0} orders in ${result?.processing_time_ms || 0}ms`,
    timestamp: new Date().toISOString()
  };
}

async function reconcileSpecificOrder(supabase: any, orderId: string): Promise<ReconcileResponse> {
  const { data: reconcileResults, error } = await supabase
    .rpc('reconcile_payment_status', { p_order_id: orderId });

  if (error) {
    throw error;
  }

  const result = reconcileResults?.[0];
  
  if (!result) {
    return {
      success: true,
      data: { updated: false },
      message: 'Order already reconciled or no successful payments found',
      timestamp: new Date().toISOString()
    };
  }

  return {
    success: true,
    data: {
      order_id: result.order_id,
      was_updated: result.was_updated,
      old_payment_status: result.old_payment_status,
      new_payment_status: result.new_payment_status,
      old_order_status: result.old_order_status,
      new_order_status: result.new_order_status
    },
    message: `Order ${orderId} successfully reconciled`,
    timestamp: new Date().toISOString()
  };
}

async function forceConfirmByReference(supabase: any, reference: string): Promise<ReconcileResponse> {
  // First, verify the transaction with Paystack
  const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  
  if (!paystackSecretKey) {
    throw new Error('Paystack configuration not found');
  }

  const paystackResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const paystackData = await paystackResponse.json();

  if (!paystackData.status || paystackData.data.status !== 'success') {
    throw new Error('Transaction not successful according to Paystack');
  }

  // Find the transaction in our database
  // Find the transaction in our database (may not exist yet)
  const { data: transactionMaybe, error: txError } = await supabase
    .from('payment_transactions')
    .select(`
      *,
      orders (*)
    `)
    .eq('provider_reference', reference)
    .maybeSingle();

  let transaction = transactionMaybe as any;

  if (!transaction) {
    // Try to resolve order by reference if missing
    let resolvedOrderId: string | null = null;
    let resolvedOrderNumber: string | null = null;

    const { data: ord } = await supabase
      .from('orders')
      .select('id, order_number')
      .or(`payment_reference.eq.${reference}`)
      .maybeSingle();

    if (ord?.id) {
      resolvedOrderId = ord.id as string;
      resolvedOrderNumber = ord.order_number as string;
    }

    // Create a backfilled PAID transaction using Paystack verified payload
    const amountNgn = typeof paystackData?.data?.amount === 'number' ? paystackData.data.amount / 100 : null;
    const paidAt = paystackData?.data?.paid_at || paystackData?.data?.transaction_date || new Date().toISOString();

    const insertPayload: any = {
      provider_reference: reference,
      order_id: resolvedOrderId,
      status: 'paid',
      amount: amountNgn,
      gateway_response: paystackData?.data?.gateway_response || 'Verified via force_confirm',
      channel: paystackData?.data?.channel || 'online',
      paid_at: new Date(paidAt).toISOString(),
      metadata: {
        source: 'force_confirm_backfill',
        order_number: resolvedOrderNumber,
      }
    };

    const { data: inserted, error: insErr } = await supabase
      .from('payment_transactions')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();

    if (insErr) {
      throw new Error(`Failed to backfill payment transaction: ${insErr.message}`);
    }

    transaction = inserted;

    // Ensure order stores this reference for future linkage
    if (resolvedOrderId) {
      await supabase
        .from('orders')
        .update({ payment_reference: reference, updated_at: new Date().toISOString() })
        .eq('id', resolvedOrderId);
    }
  }

  // Update transaction status if needed
  let transactionUpdated = false;
  if (transaction.status !== 'success' && transaction.status !== 'paid') {
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction.id);

    if (updateError) {
      throw updateError;
    }
    transactionUpdated = true;
  }

  // Call reconciliation for this order
  const { data: reconcileResults, error: reconcileError } = await supabase
    .rpc('reconcile_payment_status', { p_order_id: transaction.order_id });

  if (reconcileError) {
    throw reconcileError;
  }

  return {
    success: true,
    data: {
      reference,
      order_id: transaction.order_id,
      paystack_status: paystackData.data.status,
      transaction_updated: transactionUpdated,
      order_reconciled: reconcileResults?.length > 0
    },
    message: `Order forcefully confirmed for reference ${reference}`,
    timestamp: new Date().toISOString()
  };
}

// Additional utility function to get order payment status
async function getOrderPaymentStatus(supabase: any, orderId: string) {
  const { data, error } = await supabase
    .rpc('get_order_payment_status', { p_order_id: orderId });

  if (error) {
    throw error;
  }

  return data?.[0] || null;
}

/* Deno.serve(serve); */
