import { useState, useCallback } from 'react';
import { useApiWithRetry } from './useApiWithRetry';
import { useNetwork } from '@/components/network/NetworkProvider';
import { isNetworkError } from '@/utils/networkUtils';

interface NetworkResilienceOptions {
  maxRetries?: number;
  timeoutMs?: number;
  queueWhenOffline?: boolean;
}

export const useNetworkResilience = (options: NetworkResilienceOptions = {}) => {
  const { maxRetries = 3, timeoutMs = 10000, queueWhenOffline = true } = options;
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { invokeWithTimeout, queueFailedWrite } = useApiWithRetry();
  const { isOnline } = useNetwork();

  const executeWithResilience = useCallback(async (
    operation: () => Promise<any>,
    isWriteOperation: boolean = false
  ) => {
    if (!isOnline && queueWhenOffline && isWriteOperation) {
      console.log('🔄 Queueing write operation for later execution');
      return queueFailedWrite(operation);
    }

    let lastError: any;
    setIsRetrying(false);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setRetryCount(attempt);
        
        if (attempt > 0) {
          setIsRetrying(true);
          console.log(`🔄 Retry attempt ${attempt}/${maxRetries}`);
        }

        const result = await operation();
        setIsRetrying(false);
        setRetryCount(0);
        return result;
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt + 1} failed:`, error);

        // Don't retry if not a network error or if max retries reached
        if (!isNetworkError(error) || attempt === maxRetries) {
          break;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    setIsRetrying(false);
    throw lastError;
  }, [maxRetries, timeoutMs, queueFailedWrite, isOnline, queueWhenOffline]);

  const invokeEdgeFunction = useCallback(async (
    functionName: string, 
    options: any = {}
  ) => {
    return executeWithResilience(
      () => invokeWithTimeout(functionName, options, timeoutMs),
      false // Edge function calls are typically read operations
    );
  }, [executeWithResilience, invokeWithTimeout, timeoutMs]);

  const executeWriteOperation = useCallback(async (
    operation: () => Promise<any>
  ) => {
    return executeWithResilience(operation, true);
  }, [executeWithResilience]);

  return {
    executeWithResilience,
    invokeEdgeFunction,
    executeWriteOperation,
    retryCount,
    isRetrying,
    canRetry: retryCount < maxRetries,
    remainingRetries: maxRetries - retryCount
  };
};