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

  const initiateRegistration = async (data: RegistrationData) => {
    try {
      setIsLoading(true);
      
      // Use Supabase Auth signInWithOtp for email verification
      const { data: otpData, error } = await supabase.auth.signInWithOtp({
        email: data.email.toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback`,
          data: {
            name: data.name,
            phone: data.phone,
            registration_password: data.password, // Store temporarily in metadata
            registration_flow: 'email_otp'
          }
        }
      });

      if (error) {
        toast({
          title: "Registration failed",
          description: error.message,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      setRegistrationEmail(data.email.toLowerCase());
      setRegistrationStep('otp_verification');
      
      toast({
        title: "Verification code sent",
        description: "Please check your email for the 6-character verification code.",
      });

      return { 
        success: true, 
        requiresOtpVerification: true,
        email: data.email.toLowerCase()
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

  const verifyOTPAndCompleteRegistration = async (data: OTPVerificationData) => {
    try {
      setIsLoading(true);
      
      // Verify the OTP token with Supabase Auth
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: data.email.toLowerCase(),
        token: data.token,
        type: 'email'
      });

      if (verifyError) {
        toast({
          title: "Verification failed",
          description: verifyError.message,
          variant: "destructive"
        });
        return { success: false, error: verifyError.message };
      }

      if (!verifyData.user) {
        toast({
          title: "Verification failed",
          description: "Invalid verification code",
          variant: "destructive"
        });
        return { success: false, error: "Invalid verification code" };
      }

      // Set password for the user
      const { error: passwordError } = await supabase.auth.updateUser({
        password: data.password
      });

      if (passwordError) {
        toast({
          title: "Password setup failed",
          description: passwordError.message,
          variant: "destructive"
        });
        return { success: false, error: passwordError.message };
      }

      // Finalize registration by creating customer account and sending welcome email
      const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke('finalize-customer-registration', {
        body: {
          email: data.email.toLowerCase(),
          name: data.name,
          phone: data.phone
        }
      });

      if (finalizeError || !finalizeData?.success) {
        console.error('Finalization error:', finalizeError);
        // Don't fail completely, user is already registered in Auth
        toast({
          title: "Registration completed with warnings",
          description: "Your account was created but there may be issues with welcome email.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Registration completed!",
          description: "Your account has been created successfully. Welcome email sent.",
        });
      }

      setRegistrationStep('completed');

      return { 
        success: true, 
        user_id: verifyData.user.id,
        customer_id: finalizeData?.customer_id,
        welcome_email_sent: finalizeData?.welcome_email_queued
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

  const resendOTP = async (email: string) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.toLowerCase()
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
        title: "Code resent",
        description: "A new verification code has been sent to your email.",
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