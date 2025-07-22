
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapSettings } from '@/types/database';
import { useErrorHandler } from './useErrorHandler';

const fetchMapSettings = async (): Promise<MapSettings> => {
  const { data, error } = await supabase.functions.invoke('map-settings');
  if (error) throw new Error(`Function Error: ${error.message}`);
  return data;
};

const updateMapSettings = async (settings: Partial<MapSettings>): Promise<MapSettings> => {
  const { data, error } = await supabase.functions.invoke('map-settings', {
    body: settings,
  });
  if (error) throw new Error(`Function Error: ${error.message}`);
  return data;
};

export const useMapSettings = () => {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();

  const query = useQuery<MapSettings, Error>({
    queryKey: ['map-settings'],
    queryFn: fetchMapSettings,
  });

  const mutation = useMutation<MapSettings, Error, Partial<MapSettings>>({
    mutationFn: updateMapSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['map-settings'], data);
      handleSuccess('Map settings updated successfully.');
    },
    onError: (error) => {
      handleError(error, 'Failed to update map settings');
    },
  });

  return { ...query, updateSettings: mutation.mutate, isUpdating: mutation.isPending };
};
