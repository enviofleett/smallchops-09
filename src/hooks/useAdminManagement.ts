import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  is_active: boolean;
}

export interface AdminInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by: string;
  profiles?: { name: string };
}

export const useAdminManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch admin users
  const adminsQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.functions.invoke('admin-management', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch admin users');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch admin users');
      }

      return data.data;
    },
    refetchOnWindowFocus: false,
  });

  // Fetch admin invitations  
  const invitationsQuery = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: async (): Promise<AdminInvitation[]> => {
      const { data, error } = await supabase.functions.invoke('admin-management', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch invitations');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch invitations');
      }

      return data.data;
    },
    refetchOnWindowFocus: false,
  });

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-management', {
        body: { email, role },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send invitation');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Invitation Sent',
        description: 'Admin invitation has been sent successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Invitation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update admin user mutation
  const updateAdminMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      action, 
      role 
    }: { 
      userId: string; 
      action: 'activate' | 'deactivate' | 'update_role'; 
      role?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-management', {
        method: 'PUT',
        body: { userId, action, role },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to update admin user');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to update admin user');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      const actionText = variables.action === 'activate' ? 'activated' : 
                        variables.action === 'deactivate' ? 'deactivated' : 
                        'updated';
      
      toast({
        title: 'Admin Updated',
        description: `Admin user ${actionText} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    // Data
    admins: adminsQuery.data || [],
    invitations: invitationsQuery.data || [],
    
    // Loading states
    isLoadingAdmins: adminsQuery.isLoading,
    isLoadingInvitations: invitationsQuery.isLoading,
    
    // Error states
    adminsError: adminsQuery.error,
    invitationsError: invitationsQuery.error,
    
    // Actions
    sendInvitation: sendInvitationMutation.mutate,
    updateAdmin: updateAdminMutation.mutate,
    
    // Action states
    isSendingInvitation: sendInvitationMutation.isPending,
    isUpdatingAdmin: updateAdminMutation.isPending,
    
    // Refetch functions
    refetchAdmins: adminsQuery.refetch,
    refetchInvitations: invitationsQuery.refetch,
  };
};