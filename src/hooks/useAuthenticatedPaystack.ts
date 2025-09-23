import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook for making authenticated calls to Paystack edge functions
 * Handles authentication, error handling, and retries
 */
export const useAuthenticatedPaystack = () => {
  
  const invokePaystackSecure = useCallback(async (payload: any, retries = 2) => {
    let lastError: any = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`🔄 Calling paystack-secure (attempt ${attempt + 1}/${retries + 1}):`, payload);
        
        // Get current session to ensure we have a valid token
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No valid authentication session. Please log in.');
        }
        
        console.log('✅ Session found, making authenticated call');
        
        const { data, error } = await supabase.functions.invoke('paystack-secure', {
          body: payload
        });
        
        if (error) {
          console.error(`❌ Paystack function error (attempt ${attempt + 1}):`, error);
          
          // Check for auth errors and provide specific handling
          if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
            if (attempt < retries) {
              console.log('🔄 Auth error, refreshing session and retrying...');
              await supabase.auth.refreshSession();
              continue;
            } else {
              throw new Error('Authentication failed. Please log in again.');
            }
          }
          
          throw error;
        }
        
        console.log('✅ Paystack function success:', data);
        return { data, error: null };
        
      } catch (error: any) {
        console.error(`❌ Paystack call failed (attempt ${attempt + 1}):`, error);
        lastError = error;
        
        // Don't retry on client-side errors
        if (error.message?.includes('Authentication failed') || 
            error.message?.includes('No valid authentication')) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    // All retries failed
    const errorMessage = lastError?.message || 'Payment service unavailable';
    toast.error('Payment Error', {
      description: errorMessage
    });
    
    return { data: null, error: lastError };
  }, []);
  
  const initializePayment = useCallback(async (orderData: {
    email: string;
    amount: number;
    metadata: any;
    callback_url?: string;
  }) => {
    return invokePaystackSecure({
      action: 'initialize',
      ...orderData
    });
  }, [invokePaystackSecure]);
  
  const verifyPayment = useCallback(async (reference: string) => {
    return invokePaystackSecure({
      action: 'verify',
      reference
    });
  }, [invokePaystackSecure]);
  
  return {
    invokePaystackSecure,
    initializePayment,
    verifyPayment
  };
};