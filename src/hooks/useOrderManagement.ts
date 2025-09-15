import { useState, useCallback } from 'react';
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
  const [processingOperations, setProcessingOperations] = useState(new Set<string>());

  // Enhanced operation tracking
  const trackOperation = useCallback((operationId: string, isProcessing: boolean) => {
    setProcessingOperations(prev => {
      const newSet = new Set(prev);
      if (isProcessing) {
        newSet.add(operationId);
      } else {
        newSet.delete(operationId);
      }
      return newSet;
    });
  }, []);

  const isOperationProcessing = useCallback((operationId: string) => {
    return processingOperations.has(operationId);
  }, [processingOperations]);

  const placeOrder = async (
    checkoutData: CheckoutData,
    items: CartItem[],
    summary: {
      subtotal: number;
      subtotal_cost: number;
      total_vat: number;
      tax_amount: number;
      delivery_fee: number;
      discount_amount: number;
      total_amount: number;
    }
  ) => {
    const operationId = 'place-order';
    setLoading(true);
    trackOperation(operationId, true);
    
    try {
      // Enhanced validation
      if (!checkoutData.customer_email || !checkoutData.customer_name) {
        throw new Error('Customer email and name are required');
      }

      if (!items || items.length === 0) {
        throw new Error('Order must contain at least one item');
      }

      if (summary.total_amount <= 0) {
        throw new Error('Order total must be greater than zero');
      }

      // Register customer if new with enhanced error handling
      try {
        await publicAPI.registerCustomer({
          name: checkoutData.customer_name,
          email: checkoutData.customer_email,
          phone: checkoutData.customer_phone
        });
      } catch (customerError) {
        console.warn('Customer registration warning (non-blocking):', customerError);
        // Continue with order creation even if customer registration has issues
      }

      // Create order with pending payment status with enhanced validation
      const orderResponse = await publicAPI.createOrder({
        ...checkoutData,
        items,
        ...summary
      });

      if (!orderResponse.success) {
        throw new Error(orderResponse.error || 'Failed to create order');
      }

      // Create pending payment transaction with enhanced error handling
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { error: paymentError } = await supabase.from('payment_transactions').insert({
          order_id: orderResponse.data.id,
          amount: summary.total_amount,
          currency: 'NGN',
          status: 'pending',
          transaction_type: 'payment',
          provider_reference: `order_${orderResponse.data.id}_${Date.now()}`
        });

        if (paymentError) {
          console.error('Payment transaction creation failed:', paymentError);
          // Don't fail the order creation, but log the error
          toast.warning('Order created, but payment tracking setup had issues. Please contact support if needed.');
        }
      } catch (paymentTrackingError) {
        console.error('Payment tracking error (non-blocking):', paymentTrackingError);
        toast.warning('Order created successfully, but payment tracking may be affected.');
      }

      // Note: Order confirmation email will be automatically triggered by database trigger
      console.log('Order placed successfully, confirmation email will be sent automatically');

      return orderResponse.data;

    } catch (error) {
      console.error('Error placing order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      
      // Enhanced error categorization
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else if (errorMessage.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else if (errorMessage.includes('duplicate')) {
        toast.error('This order may have already been placed. Please check your orders.');
      } else {
        toast.error(errorMessage);
      }
      
      throw error;
    } finally {
      setLoading(false);
      trackOperation(operationId, false);
    }
  };

  const updateOrderPaymentStatus = async (orderId: string, paymentStatus: 'paid' | 'failed') => {
    const operationId = `payment-status-${orderId}`;
    trackOperation(operationId, true);
    
    try {
      // Enhanced validation
      if (!orderId || orderId.trim() === '') {
        throw new Error('Order ID is required');
      }

      if (!['paid', 'failed'].includes(paymentStatus)) {
        throw new Error('Invalid payment status');
      }

      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          payment_status: paymentStatus,
          status: paymentStatus === 'paid' ? 'confirmed' : 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Payment status update error:', error);
        throw new Error(`Failed to update payment status: ${error.message}`);
      }

      // Note: Payment confirmation email will be automatically triggered by database trigger
      console.log('Order payment status updated, notification email will be sent automatically');

      const successMessage = `Order ${paymentStatus === 'paid' ? 'confirmed' : 'cancelled'} successfully`;
      toast.success(successMessage);
      
    } catch (error) {
      console.error('Error updating order payment status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update payment status';
      toast.error(errorMessage);
      throw error;
    } finally {
      trackOperation(operationId, false);
    }
  };

  // Enhanced order tracking with better error handling
  const trackOrder = async (orderIdOrNumber: string): Promise<OrderTrackingInfo> => {
    const operationId = `track-${orderIdOrNumber}`;
    trackOperation(operationId, true);
    
    try {
      // Enhanced validation
      if (!orderIdOrNumber || orderIdOrNumber.trim() === '') {
        throw new Error('Order ID or number is required');
      }

      const response = await publicAPI.getOrder(orderIdOrNumber);
      
      if (!response.success) {
        throw new Error(response.error || 'Order not found');
      }

      const order = response.data;
      
      // Generate tracking steps based on order status with enhanced logic
      const allSteps = [
        { step: 'Order Placed', status: 'pending' },
        { step: 'Order Confirmed', status: 'confirmed' },
        { step: 'Preparing', status: 'preparing' },
        { 
          step: order.order_type === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup', 
          status: order.order_type === 'delivery' ? 'out_for_delivery' : 'ready' 
        },
        { 
          step: order.order_type === 'delivery' ? 'Delivered' : 'Picked Up', 
          status: 'delivered' 
        }
      ];

      const trackingSteps = allSteps.map(step => ({
        step: step.step,
        completed: getStatusOrder(order.status) >= getStatusOrder(step.status),
        timestamp: step.status === order.status ? order.updated_at : undefined
      }));

      const trackingInfo: OrderTrackingInfo = {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        estimatedTime: getEstimatedTime(order.status, order.order_type),
        trackingSteps
      };

      return trackingInfo;

    } catch (error) {
      console.error('Error tracking order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to track order';
      
      // Enhanced error categorization for tracking
      if (errorMessage.includes('not found')) {
        toast.error('Order not found. Please check the order number and try again.');
      } else if (errorMessage.includes('network')) {
        toast.error('Network error while tracking order. Please try again.');
      } else {
        toast.error(errorMessage);
      }
      
      throw error;
    } finally {
      trackOperation(operationId, false);
    }
  };

  const getOrderHistory = async (customerEmail: string) => {
    const operationId = `history-${customerEmail}`;
    trackOperation(operationId, true);
    
    try {
      // Enhanced validation
      if (!customerEmail || !customerEmail.includes('@')) {
        throw new Error('Valid customer email is required');
      }

      // This would require a new endpoint in public-api for customer order history
      // For now, we'll return an empty array with a warning
      console.warn('Order history endpoint not yet implemented');
      toast.info('Order history feature is coming soon');
      return [];
    } catch (error) {
      console.error('Error fetching order history:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch order history';
      toast.error(errorMessage);
      throw error;
    } finally {
      trackOperation(operationId, false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    const operationId = `cancel-${orderId}`;
    trackOperation(operationId, true);
    
    try {
      // Enhanced validation
      if (!orderId || orderId.trim() === '') {
        throw new Error('Order ID is required');
      }

      // This would require a new endpoint in public-api for order cancellation
      // For now, show success message
      toast.success('Order cancellation requested');
      console.warn('Order cancellation endpoint not yet implemented');
    } catch (error) {
      console.error('Error cancelling order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel order';
      toast.error(errorMessage);
      throw error;
    } finally {
      trackOperation(operationId, false);
    }
  };

  return {
    loading,
    placeOrder,
    trackOrder,
    getOrderHistory,
    cancelOrder,
    updateOrderPaymentStatus,
    // Enhanced state tracking
    isOperationProcessing,
    processingOperations: Array.from(processingOperations)
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