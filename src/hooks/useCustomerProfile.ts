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

export const useCustomerProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Profile Query
  const profileQuery = useQuery({
    queryKey: ['customer-profile'],
    queryFn: getCustomerProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: updateCustomerProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
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

  // Addresses Query
  const addressesQuery = useQuery({
    queryKey: ['customer-addresses'],
    queryFn: getCustomerAddresses,
    staleTime: 5 * 60 * 1000,
  });

  // Add Address Mutation
  const addAddressMutation = useMutation({
    mutationFn: addCustomerAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
      toast({
        title: "Address added",
        description: "Your new address has been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to add address",
        description: error.message,
      });
    },
  });

  // Update Address Mutation
  const updateAddressMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CustomerAddress> }) =>
      updateCustomerAddress(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
      toast({
        title: "Address updated",
        description: "Your address has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    },
  });

  // Delete Address Mutation
  const deleteAddressMutation = useMutation({
    mutationFn: deleteCustomerAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
      toast({
        title: "Address deleted",
        description: "Your address has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
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

export const useCustomerPreferences = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Preferences Query
  const preferencesQuery = useQuery({
    queryKey: ['customer-preferences'],
    queryFn: getCustomerPreferences,
    staleTime: 5 * 60 * 1000,
  });

  // Update Preferences Mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: updateCustomerPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
      toast({
        title: "Preferences updated",
        description: "Your preferences have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
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

export const useCustomerAnalytics = () => {
  return useQuery({
    queryKey: ['customer-analytics'],
    queryFn: getCustomerAnalytics,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useProfileActivity = () => {
  return useQuery({
    queryKey: ['profile-activity'],
    queryFn: getProfileActivity,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useProfileCompletion = () => {
  return useQuery({
    queryKey: ['profile-completion'],
    queryFn: calculateProfileCompletion,
    staleTime: 5 * 60 * 1000,
  });
};