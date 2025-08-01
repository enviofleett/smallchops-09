
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApiWithRetry } from "./useApiWithRetry";

export interface BusinessSettings {
  id: string;
  name: string;
  tagline?: string;
  email?: string;
  phone?: string;
  address?: string;
  website_url?: string;
  logo_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
  youtube_url?: string;
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
  created_at: string;
  updated_at: string;
}

export const useBusinessSettings = () => {
  const queryClient = useQueryClient();
  const { invokeWithRetry } = useApiWithRetry();

  const query = useQuery({
    queryKey: ['business-settings'],
    queryFn: async (): Promise<BusinessSettings | null> => {
      try {
        // Get auth session first
        const { data: session } = await supabase.auth.getSession();
        
        if (!session?.session?.access_token) {
          console.warn('No auth session available, fetching business settings without auth');
          // Try direct database query without auth for public settings
          const { data, error } = await supabase
            .from('business_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (error) {
            console.error('Error fetching business settings directly:', error);
            throw new Error(error.message || 'Failed to fetch business settings');
          }
          
          return data;
        }
        
        // Use edge function with proper auth headers
        const { data: result, error } = await invokeWithRetry('business-settings', {
          method: 'GET',
          headers: {
            'authorization': `Bearer ${session.session.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA',
            'content-type': 'application/json'
          }
        }, {
          maxRetries: 3,
          retryCondition: (error) => {
            // Retry on network errors and 5xx errors, but not auth errors
            return (error?.message?.includes('Failed to send a request') ||
                   error?.message?.includes('Network') ||
                   error?.status >= 500) && error?.status !== 401 && error?.status !== 403;
          }
        });

        if (error) {
          console.error('Error fetching business settings:', error);
          // If auth error, try direct database query
          if (error.status === 401 || error.status === 403) {
            const { data, error: dbError } = await supabase
              .from('business_settings')
              .select('*')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
              
            if (dbError) {
              throw new Error(dbError.message || 'Failed to fetch business settings');
            }
            
            return data;
          }
          throw new Error(error.message || 'Failed to fetch business settings');
        }

        return result?.data || null;
      } catch (error) {
        console.error('useBusinessSettings error:', error);
        // Fallback to direct database query
        const { data, error: dbError } = await supabase
          .from('business_settings')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (dbError) {
          throw new Error(dbError.message || 'Failed to fetch business settings');
        }
        
        return data;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Let our custom retry logic handle retries instead of react-query
      return false;
    },
  });

  const invalidateSettings = async () => {
    await queryClient.invalidateQueries({ queryKey: ['business-settings'] });
  };

  return {
    ...query,
    invalidateSettings,
  };
};
