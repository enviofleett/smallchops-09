import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export interface AdminUser {
  id: string;
  name: string;
  role: 'admin' | 'manager';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface AdminInvitation {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  status: string;
  invited_at: string;
  expires_at: string;
  invited_by: string;
}

// Enhanced function call with retry logic and proper error handling
async function callAdminFunction(
  action: string, 
  data?: any, 
  method: 'GET' | 'POST' = 'POST',
  retries = 3
): Promise<any> {
  const session = await supabase.auth.getSession();
  if (!session.data.session?.access_token) {
    throw new Error('No authentication token available');
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Use Supabase client's invoke method for better reliability
      const { data: result, error } = await supabase.functions.invoke('admin-management', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
        body: method === 'POST' ? { action, ...data } : undefined,
      });

      if (error) {
        // Handle specific error types
        if (error.message?.includes('CORS') || error.message?.includes('network')) {
          throw new Error('Network connectivity issue. Please check your connection and try again.');
        }
        if (error.message?.includes('Unauthorized') || error.message?.includes('Authentication failed')) {
          throw new Error('Session expired. Please refresh the page and try again.');
        }
        if (error.message?.includes('Admin access required')) {
          throw new Error('You do not have permission to perform this action.');
        }
        if (error.message?.includes('Too many requests')) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }
        throw new Error(error.message || 'An unexpected error occurred');
      }

      return result;
    } catch (err: any) {
      lastError = err;
      console.error(`Admin function call attempt ${attempt} failed:`, err);

      // Don't retry on authentication or permission errors
      if (err.message?.includes('Unauthorized') || 
          err.message?.includes('Admin access required') ||
          err.message?.includes('Session expired')) {
        throw err;
      }

      // Exponential backoff for retries
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to complete admin operation after multiple attempts');
}

export const useAdminManagement = () => {
  const { toast } = useToast();
  const { handleError, handleSuccess } = useErrorHandler();
  const queryClient = useQueryClient();

  // Fetch admin users
  const {
    data: admins,
    isLoading: isLoadingAdmins,
    error: adminsError
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        const result = await callAdminFunction('get_admins', undefined, 'GET');
        return result.data as AdminUser[];
      } catch (error: any) {
        handleError(error, 'Fetching admin users');
        throw error;
      }
    },
    retry: 2,
    staleTime: 30000, // 30 seconds
  });

  // Fetch admin invitations
  const {
    data: invitations,
    isLoading: isLoadingInvitations,
    error: invitationsError
  } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: async () => {
      try {
        const result = await callAdminFunction('get_invitations', undefined, 'GET');
        return result.data as AdminInvitation[];
      } catch (error: any) {
        handleError(error, 'Fetching admin invitations');
        throw error;
      }
    },
    retry: 2,
    staleTime: 30000,
  });

  // Create admin mutation
  const createAdminMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role?: string }) => {
      return await callAdminFunction('create_admin', { email, role });
    },
    onSuccess: (data) => {
      handleSuccess(data.message || 'Admin created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (error: any) => {
      handleError(error, 'Creating admin user');
    },
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Record<string, string> }) => {
      return await callAdminFunction('update_permissions', { userId, permissions });
    },
    onSuccess: () => {
      handleSuccess('Permissions updated successfully');
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
    },
    onError: (error: any) => {
      handleError(error, 'Updating permissions');
    },
  });

  // Get user permissions
  const getUserPermissions = async (userId: string) => {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        throw new Error('No authentication token available');
      }

      const { data: result, error } = await supabase.functions.invoke('admin-management', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
        // Pass userId as query parameter
        body: undefined,
      });

      if (error) throw error;
      return result.data;
    } catch (error: any) {
      handleError(error, 'Fetching user permissions');
      throw error;
    }
  };

  // Delete user (deactivate)
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'inactive' })
        .eq('id', userId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      handleSuccess('User deactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      handleError(error, 'Deactivating user');
    },
  });

  // Delete invitation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('admin_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      handleSuccess('Invitation deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (error: any) => {
      handleError(error, 'Deleting invitation');
    },
  });

  return {
    // Data
    admins: admins || [],
    invitations: invitations || [],
    
    // Loading states
    isLoadingAdmins,
    isLoadingInvitations,
    
    // Errors
    adminsError,
    invitationsError,
    
    // Mutations
    createAdmin: createAdminMutation.mutate,
    updatePermissions: updatePermissionsMutation.mutate,
    deleteUser: deleteUserMutation.mutate,
    deleteInvitation: deleteInvitationMutation.mutate,
    getUserPermissions,
    
    // Loading states for mutations
    isCreatingAdmin: createAdminMutation.isPending,
    isUpdatingPermissions: updatePermissionsMutation.isPending,
    isDeletingUser: deleteUserMutation.isPending,
    isDeletingInvitation: deleteInvitationMutation.isPending,
  };
};