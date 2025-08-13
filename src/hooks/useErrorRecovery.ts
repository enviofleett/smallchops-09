import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface ErrorRecoveryState {
  isRetrying: boolean;
  retryCount: number;
  lastError?: Error;
}

interface UseErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onMaxRetriesExceeded?: (error: Error) => void;
}

/**
 * Hook for handling error recovery and retry logic
 */
export function useErrorRecovery(options: UseErrorRecoveryOptions = {}) {
  const { maxRetries = 3, retryDelay = 1000, onMaxRetriesExceeded } = options;
  
  const [state, setState] = useState<ErrorRecoveryState>({
    isRetrying: false,
    retryCount: 0,
  });

  const retry = useCallback(async (operation: () => Promise<any>) => {
    if (state.retryCount >= maxRetries) {
      const error = state.lastError || new Error('Max retries exceeded');
      onMaxRetriesExceeded?.(error);
      toast.error(`Failed after ${maxRetries} attempts. Please try again later.`);
      return;
    }

    setState(prev => ({ ...prev, isRetrying: true }));

    try {
      // Add delay for retries (except first attempt)
      if (state.retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * state.retryCount));
      }

      const result = await operation();
      
      // Reset on success
      setState({ isRetrying: false, retryCount: 0 });
      
      if (state.retryCount > 0) {
        toast.success('Operation completed successfully!');
      }
      
      return result;
    } catch (error) {
      const newRetryCount = state.retryCount + 1;
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      setState({
        isRetrying: false,
        retryCount: newRetryCount,
        lastError: err,
      });

      if (newRetryCount >= maxRetries) {
        onMaxRetriesExceeded?.(err);
        toast.error(`Failed after ${maxRetries} attempts: ${err.message}`);
      } else {
        toast.error(`Attempt ${newRetryCount} failed. Retrying...`);
      }

      throw error;
    }
  }, [state.retryCount, state.lastError, maxRetries, retryDelay, onMaxRetriesExceeded]);

  const reset = useCallback(() => {
    setState({ isRetrying: false, retryCount: 0 });
  }, []);

  const canRetry = state.retryCount < maxRetries;

  return {
    retry,
    reset,
    canRetry,
    isRetrying: state.isRetrying,
    retryCount: state.retryCount,
    lastError: state.lastError,
  };
}