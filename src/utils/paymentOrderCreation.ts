import { supabase } from '@/integrations/supabase/client';
// import { generatePaymentReference } from './paymentReference'; // REMOVED - backend generates references

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  customization_items?: any[];
}

interface CustomerInfo {
  name: string;
  email: string;
  phone?: string;
}

interface CreateOrderParams {
  items: OrderItem[];
  customerInfo: CustomerInfo;
  totalAmount: number;
  fulfillmentType?: 'delivery' | 'pickup';
  deliveryAddress?: any;
  pickupPointId?: string;
  deliveryZoneId?: string;
  guestSessionId?: string;
}

/**
 * Create order with consistent payment reference format
 */
export const createOrderWithPayment = async (params: CreateOrderParams) => {
  // Generate consistent reference format
  const paymentReference = generatePaymentReference();
  
  console.log('🔄 Creating order with txn_ reference:', paymentReference);
  
  try {
    // Use the existing order creation function instead of direct insert
    const orderData = {
      customer_email: params.customerInfo.email,
      customer_name: params.customerInfo.name,
      customer_phone: params.customerInfo.phone,
      fulfillment_type: params.fulfillmentType || 'delivery',
      delivery_address: params.deliveryAddress,
      pickup_point_id: params.pickupPointId,
      delivery_zone_id: params.deliveryZoneId,
      order_items: params.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        customization_items: item.customization_items
      })),
      total_amount: params.totalAmount,
      delivery_fee: 0,
      payment_method: 'paystack',
      guest_session_id: params.guestSessionId
    };

    const { data, error: orderError } = await supabase.functions.invoke('process-checkout', {
      body: orderData
    });

    if (orderError || !data?.success) {
      console.error('❌ Order creation failed:', orderError || data);
      throw new Error(`Order creation failed: ${orderError?.message || data?.error || 'Unknown error'}`);
    }

    const order = data.data || data;
    console.log('✅ Order created successfully via process-checkout:', order);

    // Backend provides the payment reference - we don't generate it
    const backendReference = order.payment_reference || order.reference;
    
    if (!backendReference) {
      throw new Error('Backend did not provide payment reference');
    }

    // Initialize payment with backend-provided reference
    const { data: paymentData, error: paymentError } = await supabase.functions.invoke('paystack-secure', {
      body: {
        action: 'initialize',
        reference: backendReference, // Use backend-provided reference
        order_reference: backendReference, // Same reference for consistency
        email: params.customerInfo.email,
        amount: params.totalAmount * 100, // Convert to kobo
        metadata: {
          order_id: order.id,
          customer_name: params.customerInfo.name,
          order_number: order.order_number
        },
        callback_url: `${window.location.origin}/payment/callback?order_id=${order.id}`
      }
    });

    if (paymentError || !paymentData?.status) {
      console.error('❌ Payment initialization failed:', paymentError || paymentData);
      throw new Error(`Payment initialization failed: ${paymentError?.message || paymentData?.error || 'Unknown error'}`);
    }

    console.log('✅ Payment initialized:', paymentData.data);

    return {
      order,
      paymentUrl: paymentData.data.authorization_url,
      reference: backendReference // Backend-generated txn_ reference
    };

  } catch (error) {
    console.error('❌ Order creation process failed:', error);
    throw error;
  }
};