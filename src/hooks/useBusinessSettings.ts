
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
      // Use edge function to get business settings with retry logic
      const { data: result, error } = await invokeWithRetry('business-settings', {
        method: 'GET'
      }, {
        maxRetries: 3,
        retryCondition: (error) => {
          // Retry on network errors and 5xx errors
          return error?.message?.includes('Failed to send a request') ||
                 error?.message?.includes('Network') ||
                 error?.status >= 500;
        }
      });

      if (error) {
        console.error('Error fetching business settings:', error);
        throw new Error(error.message || 'Failed to fetch business settings');
      }

      return result?.data || null;
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
