import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  generatePasswordFromTemplate, 
  generateUsernameFromEmail, 
  DEFAULT_PASSWORD_TEMPLATES,
  generateBulkPasswords,
  type PasswordTemplate 
} from '@/lib/secure-password-utils';

interface CreateAdminUserParams {
  email: string;
  role: 'admin' | 'user';
  immediate_password?: string;
  send_email?: boolean;
  admin_created?: boolean;
  username?: string;
  password_template?: string;
  requires_password_change?: boolean;
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

      // Get the current session token for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session. Please log in again.');
      }

      // Call the edge function with explicit Authorization header
      const { data, error } = await supabase.functions.invoke('admin-user-creator', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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
    return generatePasswordFromTemplate('secure_random').password;
  };

  const generateUsernameFromEmailAddr = (email: string, format: 'full' | 'initials' | 'firstname' = 'full'): string => {
    return generateUsernameFromEmail(email, format);
  };

  const generatePasswordWithTemplate = (templateId: string, context?: { companyName?: string; email?: string; username?: string }) => {
    return generatePasswordFromTemplate(templateId, context);
  };

  const getPasswordTemplates = (): PasswordTemplate[] => {
    return DEFAULT_PASSWORD_TEMPLATES;
  };

  const createBulkAdminUsers = async (
    users: Array<{ email: string; role?: 'admin' | 'user' }>,
    options?: {
      templateId?: string;
      companyName?: string;
      sendEmail?: boolean;
    }
  ): Promise<{ success: boolean; results: Array<{ email: string; success: boolean; error?: string; username?: string; password?: string }> }> => {
    const results = [];
    const passwords = generateBulkPasswords(
      users,
      options?.templateId || 'secure_random',
      { companyName: options?.companyName }
    );

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const passwordInfo = passwords[i];
      
      try {
        const result = await createAdminUser({
          email: user.email,
          role: user.role || 'admin',
          immediate_password: passwordInfo.password,
          username: passwordInfo.username,
          requires_password_change: passwordInfo.requiresChange,
          send_email: options?.sendEmail ?? true,
          admin_created: true
        });

        results.push({
          email: user.email,
          success: result.success,
          error: result.error,
          username: passwordInfo.username,
          password: passwordInfo.password
        });
      } catch (error: any) {
        results.push({
          email: user.email,
          success: false,
          error: error.message || 'Failed to create user'
        });
      }
    }

    return {
      success: results.every(r => r.success),
      results
    };
  };

  return {
    createAdminUser,
    generateSecurePassword,
    generateUsernameFromEmailAddr,
    generatePasswordWithTemplate,
    getPasswordTemplates,
    createBulkAdminUsers,
    isCreating
  };
};