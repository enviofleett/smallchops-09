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
  deliverySchedule?: {
    delivery_date: string;
    delivery_time_start: string;
    delivery_time_end: string;
    special_instructions?: string;
    is_flexible?: boolean;
  };
}

/**
 * Create order with consistent payment reference format
 */
export const createOrderWithPayment = async (params: CreateOrderParams) => {
  console.log('🔄 Creating order with unified checkout flow');
  
  try {
    // Prepare comprehensive checkout data for process-checkout
    const checkoutData = {
      customer: {
        name: params.customerInfo.name,
        email: params.customerInfo.email,
        phone: params.customerInfo.phone
      },
      items: params.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.price,
        customizations: item.customization_items
      })),
      fulfillment: {
        type: params.fulfillmentType || 'delivery',
        address: params.deliveryAddress,
        pickup_point_id: params.pickupPointId,
        delivery_zone_id: params.deliveryZoneId,
        delivery_schedule: params.deliverySchedule
      },
      payment: {
        method: 'paystack'
      },
      terms_accepted: true
    };

    console.log('📤 Sending comprehensive checkout request to process-checkout...')

    // Single call to process-checkout handles everything
    const { data, error: checkoutError } = await supabase.functions.invoke('process-checkout', {
      body: checkoutData
    });

    // Handle checkout errors immediately
    if (checkoutError || !data?.success) {
      console.error('❌ Unified checkout failed:', checkoutError || data);
      const errorMessage = checkoutError?.message || data?.error || 'Checkout process failed';
      throw new Error(errorMessage);
    }

    console.log('✅ Unified checkout completed successfully:', {
      order_id: data.order?.id,
      order_number: data.order?.order_number,
      payment_url_available: !!data.payment?.authorization_url,
      reference_generated: !!data.payment?.reference
    });

    // Extract order and payment data from unified response
    const order = data.order;
    const payment = data.payment;

    if (!payment?.authorization_url) {
      throw new Error('Payment authorization URL not provided by backend');
    }

    if (!payment?.reference) {
      throw new Error('Payment reference not provided by backend');
    }

    // INDEPENDENT: Create delivery schedule if provided (non-blocking with upsert)
    if (params.deliverySchedule && order.id) {
      try {
        console.log('🗓️ Creating delivery schedule with upsert pattern...');
        const scheduleData = {
          order_id: order.id,
          delivery_date: params.deliverySchedule.delivery_date,
          delivery_time_start: params.deliverySchedule.delivery_time_start,
          delivery_time_end: params.deliverySchedule.delivery_time_end,
          is_flexible: params.deliverySchedule.is_flexible || false,
          special_instructions: params.deliverySchedule.special_instructions || null
        };

        const { error: scheduleError } = await supabase
          .from('order_delivery_schedule')
          .upsert(scheduleData, { 
            onConflict: 'order_id',
            ignoreDuplicates: false 
          });

        if (scheduleError) {
          console.warn('⚠️ Non-blocking: Delivery schedule upsert failed:', scheduleError);
          // Don't throw - this is independent of payment success
        } else {
          console.log('✅ Delivery schedule upserted successfully');
        }
      } catch (scheduleErr) {
        console.warn('⚠️ Non-blocking: Delivery schedule upsert error:', scheduleErr);
        // Silent failure - doesn't affect payment flow
      }
    }

    return {
      order,
      paymentUrl: payment.authorization_url, // Direct from process-checkout
      reference: payment.reference // Backend-generated txn_ reference
    };

  } catch (error) {
    console.error('❌ Order creation process failed:', error);
    throw error;
  }
};