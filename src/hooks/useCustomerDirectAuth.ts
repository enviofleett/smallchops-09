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
      
      // Create Supabase user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/customer-portal`,
          data: {
            name: data.name,
            phone: data.phone
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

      if (!authData.user) {
        toast({
          title: "Registration failed",
          description: "Failed to create user account.",
          variant: "destructive"
        });
        return { success: false, error: "Failed to create user account" };
      }

      // Create customer account record
      const { error: customerError } = await supabase
        .from('customer_accounts')
        .insert({
          user_id: authData.user.id,
          name: data.name,
          phone: data.phone
        });

      if (customerError) {
        console.error('Customer account creation error:', customerError);
        // Don't show this error to user as the main account was created
      }

      toast({
        title: "Registration successful!",
        description: "Please check your email to verify your account.",
      });

      return { 
        success: true, 
        user: authData.user,
        requiresEmailVerification: true 
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

  const signUpWithGoogle = async () => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/customer-portal`
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
    signUpWithGoogle
  };
};