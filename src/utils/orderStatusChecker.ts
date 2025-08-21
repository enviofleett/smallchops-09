// Order Status Checker Utility
import { supabase } from '@/integrations/supabase/client';

export interface OrderStatusInfo {
  order: any;
  payment_transaction: any;
  status_summary: {
    order_status: string;
    payment_status: string;
    is_completed: boolean;
    has_payment_record: boolean;
    paid_at: string | null;
  };
  timeline: any[];
}

export async function checkOrderStatus(orderIdOrReference: string): Promise<OrderStatusInfo> {
  console.log('🔍 Checking order status for:', orderIdOrReference);

  // First, try to find the order by ID or payment reference
  let orderQuery = supabase
    .from('orders')
    .select('*')
    .limit(1);

  // Check if it's a UUID (order ID) or payment reference
  if (orderIdOrReference.includes('txn_') || orderIdOrReference.includes('pay_')) {
    orderQuery = orderQuery.eq('payment_reference', orderIdOrReference);
  } else {
    orderQuery = orderQuery.eq('id', orderIdOrReference);
  }

  const { data: orderData, error: orderError } = await orderQuery.single();

  if (orderError) {
    throw new Error(`Order not found: ${orderError.message}`);
  }

  console.log('📋 Order found:', orderData);

  // Get payment transaction record
  const { data: paymentData, error: paymentError } = await supabase
    .from('payment_transactions')
    .select('*')
    .or(`order_id.eq.${orderData.id},reference.eq.${orderData.payment_reference}`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (paymentError) {
    console.warn('Payment transaction query error:', paymentError);
  }

  const paymentTransaction = paymentData && paymentData.length > 0 ? paymentData[0] : null;

  // Create status summary
  const statusSummary = {
    order_status: orderData.status,
    payment_status: orderData.payment_status,
    is_completed: orderData.status === 'confirmed' && orderData.payment_status === 'paid',
    has_payment_record: !!paymentTransaction,
    paid_at: orderData.paid_at
  };

  // Create timeline
  const timeline = [
    {
      event: 'Order Created',
      timestamp: orderData.created_at,
      status: 'completed'
    },
    {
      event: 'Payment Initiated',
      timestamp: orderData.created_at,
      status: orderData.payment_reference ? 'completed' : 'pending'
    },
    {
      event: 'Payment Verified',
      timestamp: orderData.paid_at || (paymentTransaction?.verified_at),
      status: orderData.payment_status === 'paid' ? 'completed' : 'pending'
    },
    {
      event: 'Order Confirmed',
      timestamp: orderData.status === 'confirmed' ? orderData.updated_at : null,
      status: orderData.status === 'confirmed' ? 'completed' : 'pending'
    }
  ];

  return {
    order: orderData,
    payment_transaction: paymentTransaction,
    status_summary: statusSummary,
    timeline
  };
}

export async function checkPaymentReference(reference: string) {
  console.log('🔍 Checking payment reference:', reference);

  // Check in orders table
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('payment_reference', reference)
    .single();

  // Check in payment_transactions table
  const { data: transactionData, error: transactionError } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('reference', reference)
    .single();

  return {
    order: orderError ? null : orderData,
    order_error: orderError,
    payment_transaction: transactionError ? null : transactionData,
    payment_error: transactionError,
    reference_found_in_orders: !orderError,
    reference_found_in_transactions: !transactionError
  };
}
