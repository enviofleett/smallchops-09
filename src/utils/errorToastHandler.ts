import { toast } from "@/hooks/use-toast";

interface ErrorToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  retryAction?: () => void;
  retryLabel?: string;
}

export const showErrorToast = (
  message: string,
  options: ErrorToastOptions = {}
) => {
  const {
    title = "Error",
    description = message,
    duration = 5000,
    retryAction,
    retryLabel = "Try Again"
  } = options;

  toast({
    variant: "destructive",
    title,
    description,
    duration,
  });

  // If retry action is provided, we could extend this later
  if (retryAction) {
    console.log(`Retry available: ${retryLabel}`);
  }
};

export const showNetworkErrorToast = (
  error: unknown,
  options: Omit<ErrorToastOptions, 'title'> = {}
) => {
  const errorMessage = getErrorMessage(error);
  
  showErrorToast(errorMessage, {
    title: "Connection Error",
    ...options
  });
};

export const showOrderErrorToast = (
  error: unknown,
  options: Omit<ErrorToastOptions, 'title'> = {}
) => {
  const errorMessage = getOrderErrorMessage(error);
  
  showErrorToast(errorMessage, {
    title: "Order Error",
    ...options
  });
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('non-2xx status code')) {
      return 'Service temporarily unavailable. Please try again.';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network connection issue. Please check your internet.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred. Please try again.';
};

const getOrderErrorMessage = (error: unknown): string => {
  const message = getErrorMessage(error);
  
  if (message.includes('Edge Function')) {
    return 'Order processing service is temporarily unavailable. Please try again in a moment.';
  }
  
  if (message.includes('ORDER_CREATION_FAILED')) {
    return 'Failed to create order. Please check your details and try again.';
  }
  
  if (message.includes('PAYSTACK_KEY_MISSING')) {
    return 'Payment system temporarily unavailable. Please contact support.';
  }
  
  return message;
};