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

interface RateLimitResponse {
  allowed: boolean;
  reason?: string;
  retry_after_seconds?: number;
  attempts_remaining?: number;
}

export const useCustomerDirectAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const login = async (email: string, password: string, captchaToken?: string) => {
    try {
      setIsLoading(true);
      
      const signInOptions: any = {
        email,
        password,
      };
      
      const { data, error } = await supabase.auth.signInWithPassword(signInOptions);

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

  const register = async (data: RegistrationData, captchaToken?: string) => {
    try {
      setIsLoading(true);
      
      // Check OTP rate limit first
      const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_otp_rate_limit', {
        p_email: data.email
      });

      if (rateLimitError) {
        console.error('Rate limit check error:', rateLimitError);
      }

      if (rateLimitCheck && !(rateLimitCheck as unknown as RateLimitResponse).allowed) {
        const rateLimit = rateLimitCheck as unknown as RateLimitResponse;
        const message = rateLimit.reason === 'rate_limited' 
          ? `Too many attempts. Please try again in ${Math.ceil((rateLimit.retry_after_seconds || 300) / 60)} minutes.`
          : `Account temporarily blocked. Please try again in ${Math.ceil((rateLimit.retry_after_seconds || 300) / 60)} minutes.`;
        
        toast({
          title: "Rate limit exceeded",
          description: message,
          variant: "destructive"
        });
        return { success: false, error: message };
      }

      // Prepare signup options
      const signUpOptions: any = {
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback`,
          data: {
            name: data.name,
            phone: data.phone
          }
        }
      };

      // Use secure signUp with password (not signInWithOtp)
      const { data: authData, error: authError } = await supabase.auth.signUp(signUpOptions);

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
        description: "A verification link has been sent to your email. Please check your inbox.",
      });

      return { 
        success: true, 
        requiresEmailVerification: true,
        email: data.email
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

  const resendOtp = async (email: string) => {
    try {
      setIsLoading(true);
      
      // Check rate limit
      const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_otp_rate_limit', {
        p_email: email
      });

      if (rateLimitError) {
        console.error('Rate limit check error:', rateLimitError);
      }

      if (rateLimitCheck && !(rateLimitCheck as unknown as RateLimitResponse).allowed) {
        const rateLimit = rateLimitCheck as unknown as RateLimitResponse;
        const message = rateLimit.reason === 'rate_limited' 
          ? `Too many attempts. Please try again in ${Math.ceil((rateLimit.retry_after_seconds || 300) / 60)} minutes.`
          : `Account temporarily blocked. Please try again in ${Math.ceil((rateLimit.retry_after_seconds || 300) / 60)} minutes.`;
        
        toast({
          title: "Rate limit exceeded",
          description: message,
          variant: "destructive"
        });
        return { success: false, error: message };
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback`
        }
      });

      if (error) {
        toast({
          title: "Resend failed",
          description: error.message,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      toast({
        title: "Email sent",
        description: "A new verification email has been sent to your inbox.",
      });

      return { success: true };
    } catch (error: any) {
      toast({
        title: "Resend failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithGoogle = async (captchaToken?: string) => {
    try {
      setIsLoading(true);
      
      const oauthOptions: any = {
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`
        }
      };
      
      const { error } = await supabase.auth.signInWithOAuth(oauthOptions);

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
    resendOtp,
    signUpWithGoogle
  };
};