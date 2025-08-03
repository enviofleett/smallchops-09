import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handlePostLoginRedirect } from '@/utils/redirect';

interface RegistrationData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export const useCustomerDirectAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });

      const redirectPath = handlePostLoginRedirect('customer');
      return { success: true, user: data.user, redirect: redirectPath };
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegistrationData) => {
    try {
      setIsLoading(true);
      
      // Use signInWithOtp for registration with OTP verification
      const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          data: {
            name: data.name,
            phone: data.phone,
            password: data.password // Store temporarily for OTP verification
          }
        }
      });

      if (authError) {
        toast({
          title: "Registration failed",
          description: authError.message,
          variant: "destructive"
        });
        return { success: false, error: authError.message };
      }

      toast({
        title: "Verification Required",
        description: "A one-time password has been sent to your email. Please check your inbox.",
      });

      return { 
        success: true, 
        requiresOtpVerification: true 
      };
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, token: string, password?: string) => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        toast({
          title: "Verification failed",
          description: error.message,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      // If this is a new registration with password, update the user's password
      if (password && data.user) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: password
        });

        if (passwordError) {
          console.error('Password update error:', passwordError);
          // Don't fail verification for password update errors
        }
      }

      toast({
        title: "Verification successful!",
        description: "You have been successfully logged in.",
      });

      return { 
        success: true, 
        user: data.user, 
        redirect: handlePostLoginRedirect('customer') 
      };
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithGoogle = async () => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`
        }
      });

      if (error) {
        toast({
          title: "Google authentication failed",
          description: error.message,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      toast({
        title: "Google authentication failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    login,
    register,
    verifyOtp,
    signUpWithGoogle
  };
};