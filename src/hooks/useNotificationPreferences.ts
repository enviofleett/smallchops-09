import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotificationPreferences, upsertNotificationPreferences, NotificationPreferences } from '@/api/notificationPreferences';
import { useToast } from '@/hooks/use-toast';

export const useNotificationPreferences = (customerId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const preferencesQuery = useQuery({
    queryKey: ['notification-preferences', customerId],
    queryFn: () => customerId ? getNotificationPreferences(customerId) : Promise.resolve(null),
    enabled: !!customerId,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (preferences: Omit<NotificationPreferences, 'id' | 'created_at' | 'updated_at'>) =>
      upsertNotificationPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast({
        title: "Preferences updated",
        description: "Your notification preferences have been saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update notification preferences",
      });
    },
  });

  return {
    preferences: preferencesQuery.data,
    isLoading: preferencesQuery.isLoading,
    isError: preferencesQuery.isError,
    error: preferencesQuery.error,
    updatePreferences: updatePreferencesMutation.mutate,
    isUpdating: updatePreferencesMutation.isPending,
  };
};