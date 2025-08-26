import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RegistrationData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

interface OTPVerificationData {
  email: string;
  token: string;
  password: string;
  name: string;
  phone?: string;
}

export const useSupabaseAuthRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<'registration' | 'otp_verification' | 'completed'>('registration');
  const [registrationEmail, setRegistrationEmail] = useState<string>('');
  const { toast } = useToast();

  const initiateRegistration = async (data: RegistrationData): Promise<{
    success: boolean;
    requiresOtpVerification?: boolean;
    email?: string;
    correlation_id?: string;
    error?: string;
  }> => {
    try {
      setIsLoading(true);
      
      // Client-side validation
      if (!data.name?.trim()) {
        const error = 'Full name is required';
        toast({
          title: "Registration failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      if (!data.email?.trim()) {
        const error = 'Email address is required';
        toast({
          title: "Registration failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        const error = 'Please enter a valid email address';
        toast({
          title: "Registration failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      if (!data.password?.trim()) {
        const error = 'Password is required';
        toast({
          title: "Registration failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      if (data.password.length < 8) {
        const error = 'Password must be at least 8 characters long';
        toast({
          title: "Registration failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }
      
      // Use the secure edge function endpoint with enhanced validation
      const { data: response, error } = await supabase.functions.invoke('auth-register', {
        body: {
          fullName: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          phoneNumber: data.phone?.trim() || '+1000000000' // Default for validation
        }
      });

      if (error) {
        console.error('Registration function error:', error);
        const friendly = (response as any)?.error || error.message || "Failed to initiate registration";
        toast({
          title: "Registration failed",
          description: friendly,
          variant: "destructive"
        });
        return { success: false, error: friendly };
      }

      if (response?.success) {
        setRegistrationEmail(data.email.toLowerCase().trim());
        setRegistrationStep('otp_verification');
        
        toast({
          title: "Verification code sent",
          description: "Please check your email for the 6-character verification code.",
        });

        return { 
          success: true, 
          requiresOtpVerification: true,
          email: data.email.toLowerCase().trim(),
          correlation_id: response.correlation_id
        };
      }

      const errorMessage = response?.error || "Registration failed";
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive"
      });
      return { success: false, error: errorMessage };
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error.message || "An unexpected error occurred.";
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

  const verifyOTPAndCompleteRegistration = async (data: OTPVerificationData): Promise<{
    success: boolean;
    auth_user_id?: string;
    customer_id?: string;
    welcome_email_sent?: boolean;
    correlation_id?: string;
    error?: string;
  }> => {
    try {
      setIsLoading(true);

      // Client-side validation
      if (!data.email?.trim()) {
        const error = 'Email address is required';
        toast({
          title: "Verification failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      if (!data.token?.trim()) {
        const error = 'Verification code is required';
        toast({
          title: "Verification failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      if (data.token.length !== 6) {
        const error = 'Verification code must be 6 characters';
        toast({
          title: "Verification failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }
      
      // Use the secure edge function endpoint for OTP verification
      const { data: response, error } = await supabase.functions.invoke('auth-verify-otp', {
        body: {
          email: data.email.toLowerCase().trim(),
          token: data.token.trim()
        }
      });

      if (error) {
        console.error('OTP verification function error:', error);
        const friendly = (response as any)?.error || error.message || "Failed to verify OTP";
        toast({
          title: "Verification failed",
          description: friendly,
          variant: "destructive"
        });
        return { success: false, error: friendly };
      }

      if (response?.success) {
        setRegistrationStep('completed');
        
        toast({
          title: "Registration completed!",
          description: "Your account has been created successfully. Welcome email sent.",
        });

        return { 
          success: true, 
          auth_user_id: response.auth_user_id,
          customer_id: response.customer_id,
          welcome_email_sent: response.welcome_email_sent,
          correlation_id: response.correlation_id
        };
      }

      const errorMessage = response?.error || "OTP verification failed";
      toast({
        title: "Verification failed",
        description: errorMessage,
        variant: "destructive"
      });
      return { success: false, error: errorMessage };
    } catch (error: any) {
      console.error('OTP verification error:', error);
      const errorMessage = error.message || "An unexpected error occurred.";
      toast({
        title: "Verification failed",
        description: errorMessage,
        variant: "destructive"
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const resendOTP = async (email: string): Promise<{
    success: boolean;
    error?: string;
    retry_after_seconds?: number;
  }> => {
    try {
      setIsLoading(true);

      // Client-side validation
      if (!email?.trim()) {
        const error = 'Email address is required';
        toast({
          title: "Resend failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const error = 'Please enter a valid email address';
        toast({
          title: "Resend failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }
      
      // Use the secure rate-limited resend function
      const { data: response, error } = await supabase.functions.invoke('check-otp-rate-limit', {
        body: {
          email: email.toLowerCase().trim(),
          type: 'registration'
        }
      });

      if (error) {
        console.error('Resend OTP error:', error);
        const errorMessage = error.message || "Failed to resend verification code";
        toast({
          title: "Resend failed",
          description: errorMessage,
          variant: "destructive"
        });
        return { success: false, error: errorMessage };
      }

      if (response?.allowed) {
        toast({
          title: "Code resent",
          description: "A new verification code has been sent to your email.",
        });
        return { success: true };
      } else {
        const retryAfterSeconds = response?.retry_after_seconds || 300;
        const message = `Please wait ${Math.ceil(retryAfterSeconds / 60)} minutes before requesting another code.`;
        toast({
          title: "Rate limit exceeded",
          description: message,
          variant: "destructive"
        });
        return { 
          success: false, 
          error: message,
          retry_after_seconds: retryAfterSeconds
        };
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);
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

  const resetRegistrationFlow = () => {
    setRegistrationStep('registration');
    setRegistrationEmail('');
  };

  return {
    isLoading,
    registrationStep,
    registrationEmail,
    initiateRegistration,
    verifyOTPAndCompleteRegistration,
    resendOTP,
    resetRegistrationFlow
  };
};