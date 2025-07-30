import { supabase } from "@/integrations/supabase/client";
import { useErrorHandler } from "./useErrorHandler";

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryCondition?: (error: any) => boolean;
}

export const useApiWithRetry = () => {
  const { handleError } = useErrorHandler();

  const defaultRetryCondition = (error: any) => {
    // Retry on network errors, 5xx errors, or specific CORS errors
    return (
      error?.message?.includes('Network') ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('CORS') ||
      error?.status >= 500 ||
      error?.code === 'NETWORK_ERROR' ||
      error?.code === 'TIMEOUT'
    );
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
        
        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
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
        
        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
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
    queryWithRetry
  };
};