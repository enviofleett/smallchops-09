// Enhanced Supabase client configuration with type safety and error handling
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getEnvironmentConfig } from '@/types';
import { errorLogger, ApplicationError, ErrorSeverity, ErrorCategory } from '@/lib/error-handling';

// Get environment configuration with type safety
const config = getEnvironmentConfig();

// Validate required environment variables
if (!config.VITE_SUPABASE_URL) {
  throw new ApplicationError(
    'VITE_SUPABASE_URL environment variable is required',
    'MISSING_ENV_VAR',
    ErrorSeverity.CRITICAL,
    ErrorCategory.SYSTEM
  );
}

if (!config.VITE_SUPABASE_ANON_KEY) {
  throw new ApplicationError(
    'VITE_SUPABASE_ANON_KEY environment variable is required',
    'MISSING_ENV_VAR',
    ErrorSeverity.CRITICAL,
    ErrorCategory.SYSTEM
  );
}

// Create the Supabase client with enhanced configuration
export const supabase: SupabaseClient<Database> = createClient<Database>(
  config.VITE_SUPABASE_URL,
  config.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    global: {
      headers: {
        'X-Client-Info': 'smallchops-web-app'
      }
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);

// Type-safe wrapper for Supabase operations with error handling
export class SupabaseWrapper {
  private client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  // Enhanced select with automatic error logging
  async select<T = any>(
    table: keyof Database['public']['Tables'],
    columns = '*',
    filters?: Record<string, any>
  ): Promise<{ data: T[] | null; error: any }> {
    try {
      let query = this.client.from(table as any).select(columns);
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const result = await query;
      
      if (result.error) {
        errorLogger.log(new ApplicationError(
          `Database select error on ${String(table)}: ${result.error.message}`,
          'DB_SELECT_ERROR',
          ErrorSeverity.MEDIUM,
          ErrorCategory.DATABASE,
          { table, filters, error: result.error }
        ));
      }

      return result;
    } catch (error) {
      const appError = new ApplicationError(
        `Unexpected error during select on ${String(table)}`,
        'DB_UNEXPECTED_ERROR',
        ErrorSeverity.HIGH,
        ErrorCategory.DATABASE,
        { table, filters, originalError: error }
      );
      errorLogger.log(appError);
      return { data: null, error: appError };
    }
  }

  // Enhanced insert with validation
  async insert<T = any>(
    table: keyof Database['public']['Tables'],
    data: any
  ): Promise<{ data: T | null; error: any }> {
    try {
      const result = await this.client.from(table as any).insert(data).select().single();
      
      if (result.error) {
        errorLogger.log(new ApplicationError(
          `Database insert error on ${String(table)}: ${result.error.message}`,
          'DB_INSERT_ERROR',
          ErrorSeverity.MEDIUM,
          ErrorCategory.DATABASE,
          { table, data, error: result.error }
        ));
      }

      return result;
    } catch (error) {
      const appError = new ApplicationError(
        `Unexpected error during insert on ${String(table)}`,
        'DB_UNEXPECTED_ERROR',
        ErrorSeverity.HIGH,
        ErrorCategory.DATABASE,
        { table, data, originalError: error }
      );
      errorLogger.log(appError);
      return { data: null, error: appError };
    }
  }

  // Enhanced update with optimistic locking
  async update<T = any>(
    table: keyof Database['public']['Tables'],
    data: any,
    conditions: Record<string, any>
  ): Promise<{ data: T | null; error: any }> {
    try {
      let query = this.client.from(table as any).update(data);
      
      Object.entries(conditions).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const result = await query.select().single();
      
      if (result.error) {
        errorLogger.log(new ApplicationError(
          `Database update error on ${String(table)}: ${result.error.message}`,
          'DB_UPDATE_ERROR',
          ErrorSeverity.MEDIUM,
          ErrorCategory.DATABASE,
          { table, data, conditions, error: result.error }
        ));
      }

      return result;
    } catch (error) {
      const appError = new ApplicationError(
        `Unexpected error during update on ${String(table)}`,
        'DB_UNEXPECTED_ERROR',
        ErrorSeverity.HIGH,
        ErrorCategory.DATABASE,
        { table, data, conditions, originalError: error }
      );
      errorLogger.log(appError);
      return { data: null, error: appError };
    }
  }

  // Get the raw client for complex operations
  getRawClient(): SupabaseClient<Database> {
    return this.client;
  }
}

// Create enhanced wrapper instance
export const supabaseWrapper = new SupabaseWrapper(supabase);

// Authentication helpers with error handling
export const auth = {
  signIn: async (email: string, password: string) => {
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      
      if (result.error) {
        errorLogger.log(new ApplicationError(
          `Authentication error: ${result.error.message}`,
          'AUTH_SIGNIN_ERROR',
          ErrorSeverity.MEDIUM,
          ErrorCategory.AUTHENTICATION,
          { email, error: result.error }
        ));
      }

      return result;
    } catch (error) {
      const appError = new ApplicationError(
        'Unexpected authentication error',
        'AUTH_UNEXPECTED_ERROR',
        ErrorSeverity.HIGH,
        ErrorCategory.AUTHENTICATION,
        { email, originalError: error }
      );
      errorLogger.log(appError);
      throw appError;
    }
  },

  signUp: async (email: string, password: string, options?: any) => {
    try {
      const result = await supabase.auth.signUp({ email, password, options });
      
      if (result.error) {
        errorLogger.log(new ApplicationError(
          `Registration error: ${result.error.message}`,
          'AUTH_SIGNUP_ERROR',
          ErrorSeverity.MEDIUM,
          ErrorCategory.AUTHENTICATION,
          { email, error: result.error }
        ));
      }

      return result;
    } catch (error) {
      const appError = new ApplicationError(
        'Unexpected registration error',
        'AUTH_UNEXPECTED_ERROR',
        ErrorSeverity.HIGH,
        ErrorCategory.AUTHENTICATION,
        { email, originalError: error }
      );
      errorLogger.log(appError);
      throw appError;
    }
  },

  signOut: async () => {
    try {
      const result = await supabase.auth.signOut();
      
      if (result.error) {
        errorLogger.log(new ApplicationError(
          `Sign out error: ${result.error.message}`,
          'AUTH_SIGNOUT_ERROR',
          ErrorSeverity.LOW,
          ErrorCategory.AUTHENTICATION,
          { error: result.error }
        ));
      }

      return result;
    } catch (error) {
      const appError = new ApplicationError(
        'Unexpected sign out error',
        'AUTH_UNEXPECTED_ERROR',
        ErrorSeverity.MEDIUM,
        ErrorCategory.AUTHENTICATION,
        { originalError: error }
      );
      errorLogger.log(appError);
      throw appError;
    }
  }
};

// Export types for better intellisense
export type { Database };
export type SupabaseTable = keyof Database['public']['Tables'];
export type SupabaseClient = SupabaseClient<Database>;
