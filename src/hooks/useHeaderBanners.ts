import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HeaderBanner {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  background_color: string;
  text_color: string;
  button_text?: string;
  button_url?: string;
  is_active: boolean;
  display_priority: number;
  start_date?: string;
  end_date?: string;
}

export const useHeaderBanners = () => {
  return useQuery({
    queryKey: ['header-banners'],
    queryFn: async (): Promise<HeaderBanner[]> => {
      const { data, error } = await supabase
        .from('header_banners')
        .select('*')
        .eq('is_active', true)
        .order('display_priority', { ascending: false });

      if (error) throw error;

      // Filter banners based on date range
      const now = new Date();
      return data.filter(banner => {
        const startDate = banner.start_date ? new Date(banner.start_date) : null;
        const endDate = banner.end_date ? new Date(banner.end_date) : null;
        
        return (!startDate || startDate <= now) && (!endDate || endDate >= now);
      });
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};