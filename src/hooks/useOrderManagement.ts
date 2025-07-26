import { useState } from 'react';
import { publicAPI, CheckoutData } from '@/api/public';
import { CartItem } from '@/hooks/useCart';
import { toast } from 'sonner';

export interface OrderTrackingInfo {
  orderId: string;
  orderNumber: string;
  status: string;
  estimatedTime?: string;
  trackingSteps: {
    step: string;
    completed: boolean;
    timestamp?: string;
  }[];
}

export const useOrderManagement = () => {
  const [loading, setLoading] = useState(false);

  const placeOrder = async (
    checkoutData: CheckoutData,
    items: CartItem[],
    summary: {
      subtotal: number;
      tax_amount: number;
      delivery_fee: number;
      discount_amount: number;
      total_amount: number;
    }
  ) => {
    setLoading(true);
    try {
      // Register customer if new
      await publicAPI.registerCustomer({
        name: checkoutData.customer_name,
        email: checkoutData.customer_email,
        phone: checkoutData.customer_phone
      });

      // Create order with pending payment status
      const orderResponse = await publicAPI.createOrder({
        ...checkoutData,
        items,
        ...summary
      });

      if (!orderResponse.success) {
        throw new Error(orderResponse.error || 'Failed to create order');
      }

      // Create pending payment transaction
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.from('payment_transactions').insert({
        order_id: orderResponse.data.id,
        amount: summary.total_amount,
        currency: 'NGN',
        status: 'pending',
        transaction_type: 'payment',
        provider_reference: `order_${orderResponse.data.id}_${Date.now()}`
      });

      return orderResponse.data;

    } catch (error) {
      console.error('Error placing order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateOrderPaymentStatus = async (orderId: string, paymentStatus: 'paid' | 'failed') => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          payment_status: paymentStatus,
          status: paymentStatus === 'paid' ? 'confirmed' : 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast.success(`Order ${paymentStatus === 'paid' ? 'confirmed' : 'cancelled'} successfully`);
    } catch (error) {
      console.error('Error updating order payment status:', error);
      throw error;
    }
  };

  const trackOrder = async (orderIdOrNumber: string): Promise<OrderTrackingInfo> => {
    try {
      const response = await publicAPI.getOrder(orderIdOrNumber);
      
      if (!response.success) {
        throw new Error(response.error || 'Order not found');
      }

      const order = response.data;
      
      // Generate tracking steps based on order status
      const allSteps = [
        { step: 'Order Placed', status: 'pending' },
        { step: 'Order Confirmed', status: 'confirmed' },
        { step: 'Preparing', status: 'preparing' },
        { step: order.order_type === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup', status: order.order_type === 'delivery' ? 'out_for_delivery' : 'ready' },
        { step: order.order_type === 'delivery' ? 'Delivered' : 'Picked Up', status: 'delivered' }
      ];

      const trackingSteps = allSteps.map(step => ({
        step: step.step,
        completed: getStatusOrder(order.status) >= getStatusOrder(step.status),
        timestamp: step.status === order.status ? order.updated_at : undefined
      }));

      return {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        estimatedTime: getEstimatedTime(order.status, order.order_type),
        trackingSteps
      };

    } catch (error) {
      console.error('Error tracking order:', error);
      throw error;
    }
  };

  const getOrderHistory = async (customerEmail: string) => {
    try {
      // This would require a new endpoint in public-api for customer order history
      // For now, we'll return an empty array
      return [];
    } catch (error) {
      console.error('Error fetching order history:', error);
      throw error;
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      // This would require a new endpoint in public-api for order cancellation
      toast.success('Order cancellation requested');
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  };

  return {
    loading,
    placeOrder,
    trackOrder,
    getOrderHistory,
    cancelOrder,
    updateOrderPaymentStatus
  };
};

// Helper functions
const getStatusOrder = (status: string): number => {
  const statusOrder: Record<string, number> = {
    'pending': 1,
    'confirmed': 2,
    'preparing': 3,
    'ready': 4,
    'out_for_delivery': 4,
    'delivered': 5,
    'cancelled': 0,
    'refunded': 0
  };
  return statusOrder[status] || 0;
};

const getEstimatedTime = (status: string, orderType: string): string => {
  const estimations: Record<string, Record<string, string>> = {
    'pending': { delivery: '45-60 minutes', pickup: '20-30 minutes' },
    'confirmed': { delivery: '40-55 minutes', pickup: '15-25 minutes' },
    'preparing': { delivery: '25-40 minutes', pickup: '10-20 minutes' },
    'ready': { delivery: '15-25 minutes', pickup: 'Ready now!' },
    'out_for_delivery': { delivery: '10-20 minutes', pickup: 'Ready now!' },
    'delivered': { delivery: 'Completed', pickup: 'Completed' }
  };

  return estimations[status]?.[orderType] || 'Calculating...';
};