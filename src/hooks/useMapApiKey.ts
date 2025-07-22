
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchMapApiKey = async (): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('get-map-key');
  
  if (error) {
     if (error instanceof Error) {
        if ('message' in error && typeof error.message === 'string' && error.message.includes('Function not found')) {
            throw new Error('Map service is not available. Please contact support.');
        }
         if ('message' in error && typeof error.message === 'string' && error.message.includes('User not authenticated')) {
            throw new Error('Authentication error. Please log in again.');
        }
    }
    throw new Error(`Failed to fetch map API key. ${error.message || ''}`);
  }

  if (!data?.apiKey) {
    throw new Error('Map API key not found. Please ensure it is set correctly in your project settings.');
  }

  return data.apiKey;
};

export const useMapApiKey = () => {
  return useQuery<string>({
    queryKey: ['maptiler-api-key'],
    queryFn: fetchMapApiKey,
    staleTime: Infinity, // Key is stable for the session
    retry: (failureCount, error) => {
      // Don't retry on auth errors or if key is missing
      if (error.message.includes('not found') || error.message.includes('Authentication error') || error.message.includes('not found')) {
        return false;
      }
      return failureCount < 2;
    },
  });
};
