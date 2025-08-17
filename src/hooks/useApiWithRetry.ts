import { supabase } from "@/integrations/supabase/client";
import { useErrorHandler } from "./useErrorHandler";
import { withTimeout, isNetworkError, getRetryDelay } from "@/utils/networkUtils";
import { requestQueue } from "@/utils/requestQueue";

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryCondition?: (error: any) => boolean;
}

export const useApiWithRetry = () => {
  const { handleError } = useErrorHandler();

  const defaultRetryCondition = (error: any) => {
    return isNetworkError(error);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const invokeWithTimeout = async (functionName: string, options: any = {}, timeoutMs: number = 10000) => {
    return withTimeout(supabase.functions.invoke(functionName, options), timeoutMs);
  };

  const queueFailedWrite = (operation: () => Promise<any>) => {
    if (!navigator.onLine) {
      return requestQueue.add(operation);
    }
    return operation();
  };

  const invokeWithRetry = async (
    functionName: string,
    options: any = {},
    retryOptions: RetryOptions = {}
  ) => {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      retryCondition = defaultRetryCondition
    } = retryOptions;

    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Invoking ${functionName} (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        const { data, error } = await supabase.functions.invoke(functionName, options);
        
        if (error) {
          throw error;
        }
        
        return { data, error: null };
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed for ${functionName}:`, error);
        
        // Don't retry if this is the last attempt or if error shouldn't be retried
        if (attempt === maxRetries || !retryCondition(error)) {
          break;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = getRetryDelay(attempt, baseDelay, maxDelay);
        console.log(`Retrying ${functionName} in ${delay}ms...`);
        await sleep(delay);
      }
    }
    
    // All retries failed
    console.error(`All retries failed for ${functionName}:`, lastError);
    handleError(lastError, `API call to ${functionName}`);
    return { data: null, error: lastError };
  };

  const queryWithRetry = async (
    table: string,
    query: any,
    retryOptions: RetryOptions = {}
  ) => {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      retryCondition = defaultRetryCondition
    } = retryOptions;

    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Querying ${table} (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        const { data, error } = await query;
        
        if (error) {
          throw error;
        }
        
        return { data, error: null };
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed for ${table} query:`, error);
        
        // Don't retry if this is the last attempt or if error shouldn't be retried
        if (attempt === maxRetries || !retryCondition(error)) {
          break;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = getRetryDelay(attempt, baseDelay, maxDelay);
        console.log(`Retrying ${table} query in ${delay}ms...`);
        await sleep(delay);
      }
    }
    
    // All retries failed
    console.error(`All retries failed for ${table} query:`, lastError);
    handleError(lastError, `Database query to ${table}`);
    return { data: null, error: lastError };
  };

  return {
    invokeWithRetry,
    queryWithRetry,
    invokeWithTimeout,
    queueFailedWrite
  };
};