import { ResilientSupabaseClient } from '@/lib/supabase-resilient-client';
import { supabase } from '@/integrations/supabase/client';

// Safe operations to replace common .single() patterns that cause errors

interface SafeOperationOptions {
  timeout?: number;
  fallbackData?: any;
  priority?: 'low' | 'normal' | 'high';
}

export const supabaseSafe = {
  // Safe single record fetch - uses maybeSingle to prevent errors
  async getSingle<T>(
    table: string,
    filter: (query: any) => any,
    options: SafeOperationOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    return ResilientSupabaseClient.safeSingle<T>(
      table,
      (query) => filter(query),
      options
    );
  },

  // Safe query with automatic error handling
  async getMany<T>(
    table: string,
    queryBuilder: (query: any) => any,
    options: SafeOperationOptions = {}
  ): Promise<{ data: T[] | null; error: any }> {
    const result = await ResilientSupabaseClient.safeQuery<T[]>(
      table,
      queryBuilder,
      {
        ...options,
        fallbackData: options.fallbackData || []
      }
    );

    return {
      data: result.data || [],
      error: result.error
    };
  },

  // Safe function invocation
  async invokeFunction<T>(
    functionName: string,
    args?: any,
    options: SafeOperationOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    return ResilientSupabaseClient.safeInvoke<T>(
      functionName,
      args,
      options
    );
  },

  // Safe insert operation
  async insert<T>(
    table: string,
    data: any,
    options: SafeOperationOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    return ResilientSupabaseClient.executeQuery(async () => {
      const { data: result, error } = await (supabase as any)
        .from(table)
        .insert(data)
        .select()
        .maybeSingle(); // Use maybeSingle for safety
      
      return { data: result, error };
    }, options);
  },

  // Safe update operation
  async update<T>(
    table: string,
    data: any,
    filter: (query: any) => any,
    options: SafeOperationOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    return ResilientSupabaseClient.executeQuery(async () => {
      const query = (supabase as any).from(table).update(data);
      const { data: result, error } = await filter(query)
        .select()
        .maybeSingle(); // Use maybeSingle for safety
      
      return { data: result, error };
    }, options);
  }
};

export default supabaseSafe;