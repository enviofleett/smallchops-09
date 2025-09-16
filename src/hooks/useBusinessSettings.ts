
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApiWithRetry } from "./useApiWithRetry";
import { logger, measure } from "@/lib/logger";
import { useErrorHandler } from "./useErrorHandler";

export interface BusinessSettings {
  id: string;
  name: string;
  tagline?: string;
  website_url?: string;
  logo_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
  youtube_url?: string;
  working_hours?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_alt_text?: string;
  logo_dark_url?: string;
  favicon_url?: string;
  social_card_url?: string;
  brand_guidelines?: string;
  logo_usage_rules?: string;
  whatsapp_support_number?: string;
  business_hours?: {
    monday?: { open: string; close: string; is_open: boolean };
    tuesday?: { open: string; close: string; is_open: boolean };
    wednesday?: { open: string; close: string; is_open: boolean };
    thursday?: { open: string; close: string; is_open: boolean };
    friday?: { open: string; close: string; is_open: boolean };
    saturday?: { open: string; close: string; is_open: boolean };
    sunday?: { open: string; close: string; is_open: boolean };
  };
  created_at: string;
  updated_at: string;
  allow_guest_checkout?: boolean;
  // Sensitive fields moved to business_sensitive_data table
}

export const useBusinessSettings = () => {
  const queryClient = useQueryClient();
  const { invokeWithRetry } = useApiWithRetry();
  const { handleError } = useErrorHandler();

  const query = useQuery({
    queryKey: ['business-settings'],
    queryFn: async (): Promise<BusinessSettings | null> => {
      const measurePerformance = measure.start('useBusinessSettings');
      
      try {
        logger.info('Starting business settings fetch');
        
        // First, try RPC function for public business info
        const { data, error: dbError } = await supabase
          .rpc('get_public_business_info');
          
        if (!dbError && data && data.length > 0) {
          logger.info('Business settings fetched successfully via RPC function');
          measurePerformance();
          // RPC returns an array, take the first item
          const businessData = Array.isArray(data) ? data[0] : data;
          return {
            ...businessData,
            id: 'public-business-info',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as BusinessSettings;
        }
        
        if (dbError) {
          logger.warn('Direct database query failed', dbError);
        }
        
        // Fallback: Try with authentication for admin users
        const { data: session } = await supabase.auth.getSession();
        
        if (session?.session?.access_token) {
          logger.info('Attempting authenticated edge function call');
          
          const { data: result, error } = await invokeWithRetry('business-settings', {
            method: 'GET',
            headers: {
              'authorization': `Bearer ${session.session.access_token}`,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA',
              'content-type': 'application/json'
            }
          }, {
            maxRetries: 2,
            retryCondition: (error) => {
              // Only retry on network errors, not auth errors
              return (error?.message?.includes('Failed to send a request') ||
                     error?.message?.includes('Network') ||
                     error?.status >= 500) && error?.status !== 401 && error?.status !== 403;
            }
          });

          if (!error && result?.data) {
            logger.info('Business settings fetched successfully via edge function');
            measurePerformance();
            return result.data as BusinessSettings;
          }
          
          if (error) {
            logger.warn('Edge function call failed', { status: error.status, message: error.message });
          }
        }
        
        // If we reach here and have data from the first query, return it despite any error
        if (data && data.length > 0) {
          logger.info('Returning cached data despite edge function failure');
          measurePerformance();
          const businessData = Array.isArray(data) ? data[0] : data;
          return {
            ...businessData,
            id: 'public-business-info',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as BusinessSettings;
        }
        
        // Return null instead of throwing error for graceful degradation
        logger.warn('No business settings found, returning null for graceful degradation');
        measurePerformance();
        return null;
        
      } catch (error) {
        logger.error('Critical error in useBusinessSettings', error);
        measurePerformance();
        
        // One final attempt at RPC function
        try {
          const { data, error: finalError } = await supabase
            .rpc('get_public_business_info');
            
          if (!finalError && data && data.length > 0) {
            logger.info('Final fallback query successful');
            const businessData = Array.isArray(data) ? data[0] : data;
            return {
              ...businessData,
              id: 'public-business-info',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as BusinessSettings;
          }
        } catch (finalAttemptError) {
          logger.error('Final fallback query failed', finalAttemptError);
        }
        
        // Graceful degradation - return null instead of throwing
        logger.warn('All attempts failed, returning null for graceful degradation');
        return null;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Disable react-query retries since we handle them internally
    meta: {
      errorHandler: (error: any) => {
        // Only show error to user in severe cases, not for normal Edge Function auth issues
        if (error?.message && !error.message.includes('Authentication failed')) {
          handleError(error, 'Business Settings');
        }
      }
    }
  });

  const invalidateSettings = async () => {
    await queryClient.invalidateQueries({ queryKey: ['business-settings'] });
  };

  return {
    ...query,
    invalidateSettings,
  };
};
