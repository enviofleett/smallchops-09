import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PasswordResetParams {
  targetUserId: string;
  resetMethod: 'temporary_password' | 'reset_link';
  temporaryPassword?: string;
}

export interface PasswordResetResponse {
  success: boolean;
  data?: {
    targetUser: {
      id: string;
      name: string;
      email: string;
    };
    resetMethod: string;
    temporaryPassword?: string;
    emailSent?: boolean;
    method?: string;
    requiresChange?: boolean;
  };
  error?: string;
}

export const useAdminPasswordReset = () => {
  const [isResetting, setIsResetting] = useState(false);

  const resetAdminPassword = async (params: PasswordResetParams): Promise<PasswordResetResponse> => {
    setIsResetting(true);

    try {
      // Input validation
      if (!params.targetUserId || !params.resetMethod) {
        throw new Error('Target user ID and reset method are required');
      }

      if (params.resetMethod === 'temporary_password' && params.temporaryPassword && params.temporaryPassword.length < 8) {
        throw new Error('Temporary password must be at least 8 characters long');
      }

      console.log('[ADMIN-PASSWORD-RESET] Initiating password reset:', {
        targetUserId: params.targetUserId,
        resetMethod: params.resetMethod
      });

      const { data, error } = await supabase.functions.invoke('admin-password-reset', {
        body: {
          targetUserId: params.targetUserId,
          resetMethod: params.resetMethod,
          temporaryPassword: params.temporaryPassword
        }
      });

      if (error) {
        console.error('[ADMIN-PASSWORD-RESET] Function invocation error:', error);
        throw error;
      }

      if (!data.success) {
        console.error('[ADMIN-PASSWORD-RESET] Reset failed:', data);
        throw new Error(data.error || 'Password reset failed');
      }

      console.log('[ADMIN-PASSWORD-RESET] Reset successful:', data);

      // Show success message based on reset method
      if (params.resetMethod === 'temporary_password') {
        toast.success('Temporary password generated', {
          description: `New temporary password has been set for ${data.data.targetUser.name}. They will be required to change it on next login.`
        });
      } else {
        toast.success('Password reset link sent', {
          description: `Password reset link has been sent to ${data.data.targetUser.email}`
        });
      }

      return { success: true, data: data.data };

    } catch (error: any) {
      console.error('[ADMIN-PASSWORD-RESET] Error:', error);
      
      let errorMessage = 'Failed to reset admin password. Please try again.';
      
      if (error.message?.includes('Access denied')) {
        errorMessage = 'You do not have permission to reset admin passwords.';
      } else if (error.message?.includes('Target user not found')) {
        errorMessage = 'The specified admin user was not found.';
      } else if (error.message?.includes('own password')) {
        errorMessage = 'You cannot reset your own password through this method.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error('Password Reset Failed', {
        description: errorMessage
      });

      return { success: false, error: errorMessage };
    } finally {
      setIsResetting(false);
    }
  };

  const generateSecurePassword = (): string => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  return {
    resetAdminPassword,
    generateSecurePassword,
    isResetting
  };
};