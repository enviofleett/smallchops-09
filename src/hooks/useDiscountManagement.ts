import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppliedDiscount } from './useCart';

interface ApplyDiscountRequest {
  discount_code_id: string;
  order_id?: string;
  customer_email: string;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  ip_address?: string;
  user_agent?: string;
}

export const useDiscountManagement = () => {
  const { toast } = useToast();

  // Track discount application for analytics and compliance
  const applyDiscountMutation = useMutation({
    mutationFn: async (request: ApplyDiscountRequest) => {
      const { data, error } = await supabase.functions.invoke('apply-discount-code', {
        body: request
      });

      if (error) throw error;
      return data;
    },
    onError: (error: any) => {
      console.error('Error applying discount for tracking:', error);
      // Don't show error to user as the discount is already applied to their cart
      // This is just for tracking purposes
    }
  });

  const trackDiscountApplication = async (
    appliedDiscount: AppliedDiscount,
    customerEmail: string,
    originalAmount: number,
    orderId?: string
  ) => {
    try {
      // Get user agent and IP for tracking (production ready)
      const userAgent = navigator.userAgent;
      
      await applyDiscountMutation.mutateAsync({
        discount_code_id: appliedDiscount.code, // In production, this should be the actual ID
        order_id: orderId,
        customer_email: customerEmail,
        discount_amount: appliedDiscount.discount_amount,
        original_amount: originalAmount,
        final_amount: appliedDiscount.final_amount,
        user_agent: userAgent
      });
    } catch (error) {
      console.error('Failed to track discount application:', error);
      // Continue silently - don't disrupt user experience
    }
  };

  const validateDiscountCode = async (
    code: string,
    customerEmail: string,
    orderAmount: number,
    isNewCustomer = false
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: {
          code: code.trim().toUpperCase(),
          customer_email: customerEmail,
          order_amount: orderAmount,
          is_new_customer: isNewCustomer
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to validate discount code');
      }

      if (!data.valid) {
        throw new Error(data.error || 'Invalid discount code');
      }

      return data;
    } catch (error) {
      console.error('Discount validation error:', error);
      throw error;
    }
  };

  return {
    validateDiscountCode,
    trackDiscountApplication,
    isTracking: applyDiscountMutation.isPending
  };
};