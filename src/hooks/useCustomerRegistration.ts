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
  otpCode: string;
  password: string;
  name: string;
  phone?: string;
}

export const useCustomerRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<'registration' | 'otp_verification' | 'completed'>('registration');
  const [registrationEmail, setRegistrationEmail] = useState<string>('');
  const { toast } = useToast();

  const initiateRegistration = async (data: RegistrationData) => {
    try {
      setIsLoading(true);
      
      const { data: response, error } = await supabase.functions.invoke('customer-auth-register', {
        body: {
          email: data.email.toLowerCase(),
          password: data.password,
          name: data.name,
          phone: data.phone
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
        setRegistrationEmail(data.email.toLowerCase());
        setRegistrationStep('otp_verification');
        
        toast({
          title: "Verification code sent",
          description: "Please check your email for the verification code.",
        });

        return { 
          success: true, 
          requiresOtpVerification: true,
          email: data.email.toLowerCase()
        };
      }

      return { success: false, error: response?.error || "Registration failed" };
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

  const verifyOTPAndCompleteRegistration = async (data: OTPVerificationData) => {
    try {
      setIsLoading(true);
      
      const { data: response, error } = await supabase.functions.invoke('customer-otp-verification', {
        body: {
          email: data.email.toLowerCase(),
          otpCode: data.otpCode,
          otpType: 'registration',
          password: data.password,
          name: data.name,
          phone: data.phone
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
          customer_id: response.customer_id,
          auth_user_id: response.auth_user_id,
          welcome_email_sent: response.welcome_email_sent
        };
      }

      return { success: false, error: response?.error || "OTP verification failed" };
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

  const resendOTP = async (email: string) => {
    try {
      setIsLoading(true);
      
      const { data: response, error } = await supabase.functions.invoke('check-otp-rate-limit', {
        body: {
          email: email.toLowerCase(),
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