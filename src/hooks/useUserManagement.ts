import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRoleBasedPermissions } from './useRoleBasedPermissions';
import { useAuth } from '@/contexts/AuthContext';

export type CreateUserRole = 'super_admin' | 'manager' | 'support_officer';

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

  const createUser = async (userData: CreateUserData) => {
    if (!canAssignRoles()) {
      throw new Error('Insufficient permissions to assign roles');
    }

    setIsLoading(true);
    setError(null);

    try {
      // For now, we'll create an invitation that can be used to register
      // In a full implementation, you would call a Supabase Edge Function
      // that handles user creation with proper admin privileges

      const { data, error } = await supabase
        .from('user_invitations') // Assuming this table exists
        .insert({
          email: userData.email,
          role: userData.role,
          invited_by: user?.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          name: userData.name
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
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
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      return true;
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
        .in('role', ['super_admin', 'manager', 'support_officer'])
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

  return {
    createUser,
    updateUserRole,
    deactivateUser,
    listUsers,
    isLoading,
    error,
    canAssignRoles: canAssignRoles(),
  };
};