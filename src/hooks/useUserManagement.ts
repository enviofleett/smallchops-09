import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRoleBasedPermissions } from './useRoleBasedPermissions';
import { useAuth } from '@/contexts/AuthContext';

export type CreateUserRole = 'super_admin' | 'admin' | 'manager' | 'support_officer';

export interface CreateUserData {
  email: string;
  role: CreateUserRole;
  name?: string;
}

export const useUserManagement = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { canAssignRoles } = useRoleBasedPermissions();
  const { user } = useAuth();

  const createUserInvitation = async (userData: CreateUserData) => {
    if (!canAssignRoles()) {
      throw new Error('Insufficient permissions to assign roles');
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call the Edge Function to create user invitation
      const { data, error } = await supabase.functions.invoke('role-management/create-user-invitation', {
        body: userData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      return data.invitation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user invitation';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: CreateUserRole) => {
    if (!canAssignRoles()) {
      throw new Error('Insufficient permissions to assign roles');
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call the Edge Function to update user role
      const { data, error } = await supabase.functions.invoke('role-management/update-role', {
        body: { userId, newRole },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      return data.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user role';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const deactivateUser = async (userId: string) => {
    if (!canAssignRoles()) {
      throw new Error('Insufficient permissions to deactivate users');
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'inactive' })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deactivate user';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const listUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, status, created_at, updated_at')
        .in('role', ['admin', 'manager', 'staff'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const listInvitations = async () => {
    if (!canAssignRoles()) {
      throw new Error('Insufficient permissions to view invitations');
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('admin_invitations')
        .select('id, email, role, invited_at, status, expires_at')
        .order('invited_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invitations';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    if (!canAssignRoles()) {
      throw new Error('Insufficient permissions to revoke invitations');
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('admin_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) {
        throw error;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke invitation';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createUserInvitation,
    updateUserRole,
    deactivateUser,
    listUsers,
    listInvitations,
    revokeInvitation,
    isLoading,
    error,
    canAssignRoles: canAssignRoles(),
  };
};