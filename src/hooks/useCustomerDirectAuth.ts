
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handlePostLoginRedirect } from '@/utils/redirect';

interface RegistrationData {
  name: string;
  email: string;
  password: string;
  phone: string;
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

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const signInOptions: any = {
        email,
        password,
      };
      
      const { data, error } = await supabase.auth.signInWithPassword(signInOptions);

      if (error) {
        // Provide user-friendly error messages
        let errorMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and click the verification link before signing in.';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
        }

        toast({
          title: "Login failed",
          description: errorMessage,
          variant: "destructive"
        });
        return { success: false, error: errorMessage };
      }

      // Enforce email verification - sign out unverified users
      if (data.user && !data.user.email_confirmed_at) {
        console.log('Signing out unverified user:', data.user.email);
        await supabase.auth.signOut();
        
        const errorMessage = 'Please verify your email address before signing in. Check your inbox for the verification link.';
        toast({
          title: "Email verification required",
          description: errorMessage,
          variant: "destructive"
        });
        return { success: false, error: errorMessage };
      }

      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });

      const redirectPath = handlePostLoginRedirect('customer');
      return { success: true, user: data.user, redirect: redirectPath };
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred during login.";
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive"
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegistrationData) => {
    try {
      setIsLoading(true);
      
      // Enhanced client-side validation
      if (!data.name?.trim()) {
        const error = "Full name is required";
        toast({
          title: "Registration failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      if (!data.phone?.trim()) {
        const error = "Phone number is required";
        toast({
          title: "Registration failed", 
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      // Enhanced Nigerian phone number validation
      const phoneDigits = data.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 11 || !phoneDigits.startsWith('0')) {
        const error = "Please enter a valid Nigerian phone number (11 digits starting with 0)";
        toast({
          title: "Registration failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      // Enhanced password validation
      if (data.password.length < 8) {
        const error = "Password must be at least 8 characters long";
        toast({
          title: "Registration failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }
      
      // Check OTP rate limit first with enhanced error handling
      try {
        const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_otp_rate_limit', {
          p_email: data.email
        });

        if (rateLimitError) {
          console.error('Rate limit check error:', rateLimitError);
          // Continue with registration if rate limit check fails
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
      } catch (rateLimitError) {
        console.warn('Rate limit check failed, proceeding with registration:', rateLimitError);
      }

      // Prepare signup options with comprehensive metadata
      const signUpOptions: any = {
        email: data.email.toLowerCase(),
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback`,
          data: {
            name: data.name.trim(),
            phone: data.phone.trim(),
            registration_method: 'email_password',
            phone_verified: false
          }
        }
      };

      // Use secure signUp with password
      const { data: authData, error: authError } = await supabase.auth.signUp(signUpOptions);

      if (authError) {
        // Enhanced error message handling
        let errorMessage = authError.message;
        if (authError.message.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Please try signing in instead.';
        } else if (authError.message.includes('Password should be')) {
          errorMessage = 'Password is too weak. Please choose a stronger password with at least 8 characters.';
        } else if (authError.message.includes('Invalid email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (authError.message.includes('signup is disabled')) {
          errorMessage = 'Account registration is temporarily unavailable. Please try again later.';
        }

        toast({
          title: "Registration failed",
          description: errorMessage,
          variant: "destructive"
        });
        return { success: false, error: errorMessage };
      }

      // Handle different signup scenarios
      if (authData.user && !authData.user.email_confirmed_at) {
        toast({
          title: "Verification Required",
          description: "A verification link has been sent to your email. Please check your inbox.",
        });

        return { 
          success: true, 
          requiresEmailVerification: true,
          email: data.email.toLowerCase()
        };
      } else if (authData.user && authData.user.email_confirmed_at) {
        // User was immediately confirmed (auto-confirm enabled)
        toast({
          title: "Registration successful!",
          description: "Welcome! Your account has been created.",
        });

        return { 
          success: true, 
          user: authData.user,
          requiresEmailVerification: false
        };
      } else {
        // Fallback case
        return { 
          success: true, 
          requiresEmailVerification: true,
          email: data.email.toLowerCase()
        };
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error.message || "An unexpected error occurred during registration.";
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive"
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async (email: string) => {
    try {
      setIsLoading(true);
      
      // Check rate limit with proper error handling
      try {
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
      } catch (rateLimitError) {
        console.warn('Rate limit check failed, proceeding with resend:', rateLimitError);
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback`
        }
      });

      if (error) {
        let errorMessage = error.message;
        if (error.message.includes('For security purposes')) {
          errorMessage = 'Please wait a few minutes before requesting another verification email.';
        }

        toast({
          title: "Resend failed",
          description: errorMessage,
          variant: "destructive"
        });
        return { success: false, error: errorMessage };
      }

      toast({
        title: "Email sent",
        description: "A new verification email has been sent to your inbox.",
      });

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred.";
      toast({
        title: "Resend failed",
        description: errorMessage,
        variant: "destructive"
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithGoogle = async () => {
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
