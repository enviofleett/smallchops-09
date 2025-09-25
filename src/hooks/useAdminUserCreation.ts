import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateAdminUserParams {
  email: string;
  role: 'admin' | 'user';
  immediate_password?: string;
  send_email?: boolean;
  admin_created?: boolean;
}

interface AdminUserCreationResponse {
  success: boolean;
  data?: {
    user_id: string;
    email: string;
    role: string;
    immediate_access: boolean;
    password?: string;
  };
  error?: string;
  code?: string;
  message?: string;
}

export const useAdminUserCreation = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const createAdminUser = async (params: CreateAdminUserParams): Promise<{ success: boolean; data?: any; error?: string }> => {
    setIsCreating(true);

    try {
      // Input validation
      if (!params.email || !params.role) {
        throw new Error('Email and role are required');
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(params.email)) {
        throw new Error('Invalid email format');
      }

      // Password validation for immediate access
      if (params.immediate_password && params.immediate_password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      console.log('[ADMIN-USER-CREATION] Creating user:', params.email);

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('admin-user-creator', {
        body: {
          email: params.email.toLowerCase().trim(),
          role: params.role,
          immediate_password: params.immediate_password,
          send_email: params.send_email ?? true,
          admin_created: params.admin_created ?? true
        }
      });

      if (error) {
        console.error('[ADMIN-USER-CREATION] Function invocation error:', error);
        throw error;
      }

      const result = data as AdminUserCreationResponse;

      if (!result.success) {
        // Handle specific error codes
        if (result.code === 'USER_EXISTS') {
          toast({
            title: 'User Already Exists',
            description: 'An admin user with this email already exists. Please use a different email address.',
            variant: 'destructive'
          });
          return { success: false, error: 'User already exists' };
        } else if (result.code === 'INVALID_EMAIL') {
          toast({
            title: 'Invalid Email',
            description: 'Please enter a valid email address format.',
            variant: 'destructive'
          });
          return { success: false, error: 'Invalid email format' };
        } else {
          toast({
            title: 'Creation Failed',
            description: result.error || result.message || 'Failed to create admin user',
            variant: 'destructive'
          });
          return { success: false, error: result.error || result.message };
        }
      }

      // Success case
      const successMessage = params.immediate_password 
        ? `Admin user created with immediate access. Password: ${result.data?.password}`
        : 'Admin user created successfully and invitation email sent';

      toast({
        title: 'Admin Created Successfully',
        description: successMessage,
      });

      console.log('[ADMIN-USER-CREATION] User created successfully:', result.data?.user_id);
      
      return { success: true, data: result.data };

    } catch (error: any) {
      console.error('[ADMIN-USER-CREATION] Error:', error);
      
      let errorTitle = 'Creation Failed';
      let errorDescription = 'Failed to create admin user. Please try again.';
      
      // Parse error message for specific cases
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('FunctionsHttpError') || errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
        errorTitle = 'Connection Error';
        errorDescription = 'Unable to connect to the server. Please check your internet connection.';
      } else if (errorMessage.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The server encountered an error. Please try again.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        errorTitle = 'Permission Denied';
        errorDescription = 'You do not have permission to create admin users.';
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorTitle = 'Session Expired';
        errorDescription = 'Please refresh the page and try again.';
      } else if (errorMessage.includes('timeout')) {
        errorTitle = 'Request Timeout';
        errorDescription = 'The request took too long. Please try again.';
      } else if (errorMessage) {
        errorDescription = errorMessage;
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive'
      });

      return { success: false, error: errorDescription };
    } finally {
      setIsCreating(false);
    }
  };

  const generateSecurePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure we have at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special
    
    // Fill the rest randomly
    for (let i = 4; i < 14; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  return {
    createAdminUser,
    generateSecurePassword,
    isCreating
  };
};