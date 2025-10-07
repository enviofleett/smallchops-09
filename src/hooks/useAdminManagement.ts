import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by: string;
  profiles?: {
    name: string;
  };
}

interface UpdateAdminData {
  userId: string;
  action: 'activate' | 'deactivate' | 'update_role';
  role?: string;
}

export const useAdminManagement = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);
  const { toast } = useToast();

  // Fetch admin users using the new role-based system
  const fetchAdmins = async () => {
    try {
      setIsLoadingAdmins(true);
      const { data, error } = await supabase.functions.invoke('admin-management?action=get_admins', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) throw error;

      if (data?.success) {
        setAdmins(data.data || []);
      } else {
        throw new Error(data?.error || 'Failed to fetch admins');
      }
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin users',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  // Fetch invitations
  const fetchInvitations = async () => {
    try {
      setIsLoadingInvitations(true);
      const { data, error } = await supabase.functions.invoke('admin-management?action=get_invitations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) throw error;

      if (data?.success) {
        setInvitations(data.data || []);
      } else {
        throw new Error(data?.error || 'Failed to fetch invitations');
      }
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load invitations',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingInvitations(false);
    }
  };

  // Update admin user
  const updateAdmin = async (data: UpdateAdminData) => {
    try {
      setIsUpdatingAdmin(true);
      
      const { data: response, error } = await supabase.functions.invoke('admin-management', {
        method: 'PUT',
        body: data
      });

      if (error) throw error;

      if (response?.success) {
        toast({
          title: 'Success',
          description: response.message || 'Admin user updated successfully',
        });
        
        // Refresh admins
        await fetchAdmins();
      } else {
        throw new Error(response?.error || 'Failed to update admin user');
      }
    } catch (error: any) {
      console.error('Error updating admin:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update admin user',
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingAdmin(false);
    }
  };

  // Delete invitation
  const deleteInvitation = async (invitationId: string) => {
    try {
      const { data: response, error } = await supabase.functions.invoke('admin-management', {
        body: {
          action: 'delete_invitation',
          invitationId
        }
      });

      if (error) throw error;

      if (response?.success) {
        toast({
          title: 'Success',
          description: 'Invitation deleted successfully',
        });
        
        // Refresh invitations
        await fetchInvitations();
      } else {
        throw new Error(response?.error || 'Failed to delete invitation');
      }
    } catch (error: any) {
      console.error('Error deleting invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete invitation',
        variant: 'destructive'
      });
    }
  };

  // Resend invitation
  const resendInvitation = async (invitationId: string) => {
    try {
      const { data: response, error } = await supabase.functions.invoke('admin-management', {
        body: {
          action: 'resend_invitation',
          invitationId
        }
      });

      if (error) throw error;

      if (response?.success) {
        toast({
          title: 'Success',
          description: 'Invitation resent successfully',
        });
        
        // Refresh invitations
        await fetchInvitations();
      } else {
        throw new Error(response?.error || 'Failed to resend invitation');
      }
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive'
      });
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchAdmins();
    fetchInvitations();
  }, []);

  return {
    admins,
    invitations,
    isLoadingAdmins,
    isLoadingInvitations,
    isSendingInvitation,
    isUpdatingAdmin,
    updateAdmin,
    deleteInvitation,
    resendInvitation,
    fetchAdmins,
    fetchInvitations
  };
};