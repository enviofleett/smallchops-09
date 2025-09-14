
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
        logger.info('Starting business settings fetch using secure function');
        
        // Use the new secure public function
        const { data, error } = await supabase.rpc('get_public_business_info');
        
        if (error) {
          logger.warn('Public business info function failed', error);
          throw new Error(`Failed to fetch business settings: ${error.message}`);
        }
        
        if (!data) {
          logger.warn('No business settings data returned from secure function');
          measurePerformance();
          return null;
        }

        // Transform the function result to match BusinessSettings interface
        const businessInfo = data as Record<string, any>;
        const businessSettings: BusinessSettings = {
          id: 'public-view',
          name: businessInfo.name || 'Starters Small Chops',
          tagline: businessInfo.tagline || 'Delicious Nigerian Small Chops',
          logo_url: businessInfo.logo_url,
          logo_dark_url: businessInfo.logo_dark_url,
          favicon_url: businessInfo.favicon_url,
          primary_color: businessInfo.primary_color || '#3b82f6',
          secondary_color: businessInfo.secondary_color || '#1e40af',
          accent_color: businessInfo.accent_color || '#f59e0b',
          website_url: businessInfo.website_url,
          facebook_url: businessInfo.social_links?.facebook,
          instagram_url: businessInfo.social_links?.instagram,
          twitter_url: businessInfo.social_links?.twitter,
          linkedin_url: businessInfo.social_links?.linkedin,
          youtube_url: businessInfo.social_links?.youtube,
          tiktok_url: businessInfo.social_links?.tiktok,
          seo_title: businessInfo.seo?.title || 'Starters Small Chops',
          seo_description: businessInfo.seo?.description || 'Premium Nigerian small chops and catering services',
          seo_keywords: businessInfo.seo?.keywords || 'small chops, catering, Nigerian food',
          working_hours: businessInfo.working_hours || 'Mon-Sat: 9AM-9PM',
          business_hours: businessInfo.business_hours || {},
          whatsapp_support_number: '', // Not included in public view for security
          allow_guest_checkout: true, // Default value
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        logger.info('Business settings fetched successfully via secure function');
        measurePerformance();
        return businessSettings;
        
      } catch (error) {
        logger.error('Error in useBusinessSettings', error);
        measurePerformance();
        
        // Return graceful fallback data to prevent app crashes
        logger.warn('Returning fallback business settings due to error');
        
        const fallbackSettings: BusinessSettings = {
          id: 'fallback',
          name: 'Starters Small Chops',
          tagline: 'Delicious Nigerian Small Chops',
          logo_url: '',
          logo_dark_url: '',
          favicon_url: '',
          primary_color: '#3b82f6',
          secondary_color: '#1e40af',
          accent_color: '#f59e0b',
          website_url: '',
          facebook_url: '',
          instagram_url: '',
          twitter_url: '',
          linkedin_url: '',
          youtube_url: '',
          tiktok_url: '',
          seo_title: 'Starters Small Chops',
          seo_description: 'Premium Nigerian small chops and catering services',
          seo_keywords: 'small chops, catering, Nigerian food',
          working_hours: 'Mon-Sat: 9AM-9PM',
          business_hours: {},
          whatsapp_support_number: '',
          allow_guest_checkout: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        return fallbackSettings;
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
