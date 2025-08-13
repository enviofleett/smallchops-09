import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  getCustomerProfile,
  updateCustomerProfile,
  getCustomerAddresses,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  getCustomerPreferences,
  updateCustomerPreferences,
  getCustomerAnalytics,
  getProfileActivity,
  calculateProfileCompletion,
  type CustomerProfile,
  type CustomerAddress,
  type CustomerPreferences
} from '@/api/customerProfile';

// Constants for query keys to prevent typos
const QUERY_KEYS = {
  PROFILE: 'customer-profile',
  ADDRESSES: 'customer-addresses',
  PREFERENCES: 'customer-preferences',
  ANALYTICS: 'customer-analytics',
  ACTIVITY: 'profile-activity',
  COMPLETION: 'profile-completion'
};

const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_RETRY = 3;

// Helper for consistent error toasts
const useErrorToast = () => {
  const { toast } = useToast();
  return (error: Error, title: string) => {
    toast({
      variant: "destructive",
      title,
      description: error.message,
    });
  };
};

export const useCustomerProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const showError = useErrorToast();

  // Profile Query
  const profileQuery = useQuery<CustomerProfile>({
    queryKey: [QUERY_KEYS.PROFILE],
    queryFn: getCustomerProfile,
    staleTime: DEFAULT_STALE_TIME,
    retry: DEFAULT_RETRY,
  });

  // Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: updateCustomerProfile,
    onMutate: async (updatedProfile) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.PROFILE] });
      
      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData([QUERY_KEYS.PROFILE]);
      
      // Optimistically update to the new value
      queryClient.setQueryData([QUERY_KEYS.PROFILE], (old: CustomerProfile) => ({
        ...old,
        ...updatedProfile
      }));
      
      return { previousProfile };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PROFILE] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMPLETION] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    },
    onError: (error: Error, _, context) => {
      // Rollback to previous state on error
      if (context?.previousProfile) {
        queryClient.setQueryData([QUERY_KEYS.PROFILE], context.previousProfile);
      }
      showError(error, "Update failed");
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError,
    error: profileQuery.error,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
    refetch: profileQuery.refetch
  };
};

export const useCustomerAddresses = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const showError = useErrorToast();

  // Addresses Query
  const addressesQuery = useQuery<CustomerAddress[]>({
    queryKey: [QUERY_KEYS.ADDRESSES],
    queryFn: getCustomerAddresses,
    staleTime: DEFAULT_STALE_TIME,
    retry: DEFAULT_RETRY,
  });

  // Add Address Mutation
  const addAddressMutation = useMutation({
    mutationFn: addCustomerAddress,
    onMutate: async (newAddress) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ADDRESSES] });
      const previousAddresses = queryClient.getQueryData([QUERY_KEYS.ADDRESSES]);
      
      queryClient.setQueryData([QUERY_KEYS.ADDRESSES], (old: CustomerAddress[] = []) => [
        ...old,
        { ...newAddress, id: 'temp-id' } // Temporary ID until real one comes from server
      ]);
      
      return { previousAddresses };
    },
    onSuccess: (result) => {
      // Replace the temporary address with the real one from server
      queryClient.setQueryData([QUERY_KEYS.ADDRESSES], (old: CustomerAddress[] = []) => 
        old.map(addr => addr.id === 'temp-id' ? result : addr)
      );
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMPLETION] });
      toast({
        title: "Address added",
        description: "Your new address has been saved",
      });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousAddresses) {
        queryClient.setQueryData([QUERY_KEYS.ADDRESSES], context.previousAddresses);
      }
      showError(error, "Failed to add address");
    },
  });

  // Update Address Mutation
  const updateAddressMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CustomerAddress> }) =>
      updateCustomerAddress(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ADDRESSES] });
      const previousAddresses = queryClient.getQueryData([QUERY_KEYS.ADDRESSES]);
      
      queryClient.setQueryData([QUERY_KEYS.ADDRESSES], (old: CustomerAddress[] = []) =>
        old.map(addr => addr.id === id ? { ...addr, ...updates } : addr)
      );
      
      return { previousAddresses };
    },
    onSuccess: () => {
      toast({
        title: "Address updated",
        description: "Your address has been updated successfully",
      });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousAddresses) {
        queryClient.setQueryData([QUERY_KEYS.ADDRESSES], context.previousAddresses);
      }
      showError(error, "Update failed");
    },
  });

  // Delete Address Mutation
  const deleteAddressMutation = useMutation({
    mutationFn: deleteCustomerAddress,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.ADDRESSES] });
      const previousAddresses = queryClient.getQueryData([QUERY_KEYS.ADDRESSES]);
      
      queryClient.setQueryData([QUERY_KEYS.ADDRESSES], (old: CustomerAddress[] = []) =>
        old.filter(addr => addr.id !== id)
      );
      
      return { previousAddresses };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COMPLETION] });
      toast({
        title: "Address deleted",
        description: "Your address has been removed",
      });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousAddresses) {
        queryClient.setQueryData([QUERY_KEYS.ADDRESSES], context.previousAddresses);
      }
      showError(error, "Delete failed");
    },
  });

  return {
    addresses: addressesQuery.data || [],
    isLoading: addressesQuery.isLoading,
    isError: addressesQuery.isError,
    error: addressesQuery.error,
    addAddress: addAddressMutation.mutate,
    updateAddress: updateAddressMutation.mutate,
    deleteAddress: deleteAddressMutation.mutate,
    isAdding: addAddressMutation.isPending,
    isUpdating: updateAddressMutation.isPending,
    isDeleting: deleteAddressMutation.isPending,
  };
};

// Other hooks (Preferences, Analytics, Activity, Completion) follow similar patterns
// ... [rest of the hooks implementation]
