import React, { useEffect } from 'react';
import { toast } from 'sonner';

interface CheckoutErrorMonitorProps {
  children: React.ReactNode;
}

export const CheckoutErrorMonitor: React.FC<CheckoutErrorMonitorProps> = ({ children }) => {
  useEffect(() => {
    // Monitor CORS errors and provide user-friendly feedback
    const originalConsoleError = console.error;
    
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      
      // Monitor for CORS-related errors
      if (errorMessage.includes('Access-Control-Allow-Headers') || 
          errorMessage.includes('CORS policy') ||
          errorMessage.includes('x-guest-session-id')) {
        toast.error('Checkout connection issue detected. Refreshing...', {
          description: 'Please wait while we fix the connection.',
          duration: 3000
        });
        
        // Auto-refresh after 2 seconds to recover from CORS issues
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
      
      // Monitor for payment processing errors
      if (errorMessage.includes('FunctionsFetchError') || 
          errorMessage.includes('Failed to send a request to the Edge Function')) {
        toast.error('Payment processing temporarily unavailable', {
          description: 'Please try again or contact support if the issue persists.',
          duration: 5000
        });
      }
      
      // Call original console.error
      originalConsoleError(...args);
    };
    
    // Cleanup
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  return <>{children}</>;
};