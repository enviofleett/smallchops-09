import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Compatible interfaces matching the existing system
interface RegistrationFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
}

interface OTPVerificationData {
  email: string;
  token: string;
}

interface RegistrationResponse {
  success: boolean;
  error?: string;
  requiresOtpVerification?: boolean;
  email?: string;
  correlation_id?: string;
  message?: string;
}

interface OTPVerificationResponse {
  success: boolean;
  error?: string;
  auth_user_id?: string;
  customer_id?: string;
  email_verified?: boolean;
  welcome_email_sent?: boolean;
  correlation_id?: string;
  message?: string;
}

export const useRegistrationSystem = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<'registration' | 'otp_verification' | 'completed'>('registration');
  const [registrationEmail, setRegistrationEmail] = useState<string>('');
  const [correlationId, setCorrelationId] = useState<string>('');
  const { toast } = useToast();

  // Initialize registration with security hardening
  const initiateRegistration = async (data: RegistrationFormData): Promise<RegistrationResponse> => {
    try {
      setIsLoading(true);
      
      // Input validation
      if (!data.fullName?.trim() || !data.email?.trim() || !data.phoneNumber?.trim()) {
        const error = "All fields are required";
        toast({
          title: "Registration failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      // Call new secure auth-register endpoint
      const { data: response, error } = await supabase.functions.invoke('auth-register', {
        body: {
          fullName: data.fullName.trim(),
          email: data.email.toLowerCase().trim(),
          phoneNumber: data.phoneNumber.trim()
        }
      });

      if (error) {
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
        setCorrelationId(response.correlation_id || '');
        setRegistrationStep('otp_verification');
        
        toast({
          title: "Verification code sent",
          description: "Please check your email for the 6-character verification code.",
        });

        return { 
          success: true, 
          requiresOtpVerification: true,
          email: data.email.toLowerCase().trim(),
          correlation_id: response.correlation_id,
          message: response.message
        };
      }

      return { success: false, error: response?.error || "Registration failed" };
    } catch (error: any) {
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

  // Verify OTP with enhanced security
  const verifyOTPAndCompleteRegistration = async (data: OTPVerificationData): Promise<OTPVerificationResponse> => {
    try {
      setIsLoading(true);
      
      // Input validation
      if (!data.email?.trim() || !data.token?.trim()) {
        const error = "Email and verification code are required";
        toast({
          title: "Verification failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      // Validate token format
      if (!/^[A-Z0-9]{6}$/.test(data.token.trim())) {
        const error = "Verification code must be 6 characters";
        toast({
          title: "Verification failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      // Call new secure auth-verify-otp endpoint
      const { data: response, error } = await supabase.functions.invoke('auth-verify-otp', {
        body: {
          email: data.email.toLowerCase().trim(),
          token: data.token.trim().toUpperCase()
        }
      });

      if (error) {
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
          description: "Your account has been created successfully. You can now log in.",
        });

        return { 
          success: true, 
          auth_user_id: response.auth_user_id,
          customer_id: response.customer_id,
          email_verified: response.email_verified,
          welcome_email_sent: response.welcome_email_sent,
          correlation_id: response.correlation_id,
          message: response.message
        };
      }

      return { success: false, error: response?.error || "OTP verification failed" };
    } catch (error: any) {
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

  // Resend OTP with rate limiting
  const resendOTP = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      
      if (!email?.trim()) {
        const error = "Email is required to resend verification code";
        toast({
          title: "Resend failed",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      // Use existing rate-limited resend functionality
      const { data: response, error } = await supabase.functions.invoke('check-otp-rate-limit', {
        body: {
          email: email.toLowerCase().trim(),
          type: 'registration'
        }
      });

      if (error) {
        toast({
          title: "Resend failed",
          description: error.message || "Failed to resend verification code",
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      if (response?.allowed) {
        toast({
          title: "Code resent",
          description: "A new verification code has been sent to your email.",
        });
        return { success: true };
      } else {
        const message = `Please wait ${Math.ceil((response?.retry_after_seconds || 300) / 60)} minutes before requesting another code.`;
        toast({
          title: "Rate limit exceeded",
          description: message,
          variant: "destructive"
        });
        return { success: false, error: message };
      }
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

  // Reset registration flow
  const resetRegistrationFlow = () => {
    setRegistrationStep('registration');
    setRegistrationEmail('');
    setCorrelationId('');
  };

  // Get user profile (optional feature)
  const getUserProfile = async (): Promise<any> => {
    try {
      const { data: response, error } = await supabase.functions.invoke('auth-profile');
      
      if (error || !response?.success) {
        return null;
      }
      
      return response.profile;
    } catch (error) {
      console.error('Profile fetch error:', error);
      return null;
    }
  };

  return {
    // State
    isLoading,
    registrationStep,
    registrationEmail,
    correlationId,
    
    // Actions
    initiateRegistration,
    verifyOTPAndCompleteRegistration,
    resendOTP,
    resetRegistrationFlow,
    getUserProfile
  };
};