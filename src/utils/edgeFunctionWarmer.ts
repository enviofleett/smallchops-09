import React from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Edge Function Warmer - Preloads edge functions to reduce cold start latency
 */
class EdgeFunctionWarmer {
  private warmedFunctions = new Set<string>();
  private warmupPromises = new Map<string, Promise<void>>();

  /**
   * Warm up an edge function by making a lightweight request
   */
  async warmFunction(functionName: string): Promise<void> {
    if (this.warmedFunctions.has(functionName)) {
      return;
    }

    // Return existing warmup promise if in progress
    if (this.warmupPromises.has(functionName)) {
      return this.warmupPromises.get(functionName);
    }

    const warmupPromise = this.performWarmup(functionName);
    this.warmupPromises.set(functionName, warmupPromise);

    try {
      await warmupPromise;
      this.warmedFunctions.add(functionName);
    } catch (error) {
      console.warn(`Failed to warm function ${functionName}:`, error);
    } finally {
      this.warmupPromises.delete(functionName);
    }
  }

  private async performWarmup(functionName: string): Promise<void> {
    try {
      // Make a lightweight ping request with minimal data
      await Promise.race([
        supabase.functions.invoke(functionName, {
          body: { warmup: true, timestamp: Date.now() }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Warmup timeout')), 2000)
        )
      ]);
    } catch (error) {
      // Ignore warmup errors - they're not critical
      console.debug(`Warmup request for ${functionName} completed:`, error);
    }
  }

  /**
   * Pre-warm checkout-related functions
   */
  async warmCheckoutFunctions(): Promise<void> {
    const checkoutFunctions = [
      'process-checkout',
      'process-order-with-promotions',
      'recover-order-schedule'
    ];

    // Warm functions in parallel without blocking
    const warmupPromises = checkoutFunctions.map(fn => 
      this.warmFunction(fn).catch(() => {}) // Silent fail for warmup
    );

    // Don't await - let them warm in background
    Promise.all(warmupPromises).then(() => {
      console.debug('Checkout functions warmed');
    });
  }

  /**
   * Check if a function has been warmed
   */
  isWarmed(functionName: string): boolean {
    return this.warmedFunctions.has(functionName);
  }

  /**
   * Reset warmed function cache
   */
  reset(): void {
    this.warmedFunctions.clear();
    this.warmupPromises.clear();
  }
}

export const edgeFunctionWarmer = new EdgeFunctionWarmer();

/**
 * Hook to warm functions when component mounts
 */
export const useEdgeFunctionWarmer = (functions: string[]) => {
  React.useEffect(() => {
    functions.forEach(fn => {
      edgeFunctionWarmer.warmFunction(fn).catch(() => {});
    });
  }, [functions]);
};