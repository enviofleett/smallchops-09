import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OTPAuthResult {
  success: boolean;
  loginVerified?: boolean;
  emailVerified?: boolean;
  resetVerified?: boolean;
  email?: string;
  error?: string;
  rateLimited?: boolean;
  otpSent?: boolean;
}

export const useOTPAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendOTP = async (
    email: string, 
    purpose: 'login' | 'registration' | 'password_reset',
    customerName?: string
  ) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('generate-otp-email', {
        body: {
          email,
          purpose,
          customerName
        }
      });

      if (error) throw error;

      if (data?.rateLimited) {
        toast({
          title: "Too many requests",
          description: "Please wait before requesting another code.",
          variant: "destructive",
        });
        return { success: false, rateLimited: true };
      }

      return { success: true, expiresIn: data?.expiresIn };
    } catch (error: any) {
      toast({
        title: "Failed to send code",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (
    email: string,
    code: string,
    purpose: 'login' | 'registration' | 'password_reset'
  ): Promise<OTPAuthResult> => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: {
          email,
          code,
          purpose
        }
      });

      if (error) throw error;

      if (data?.notFound || data?.expired || data?.invalidCode || data?.maxAttemptsReached) {
        return { success: false, ...data };
      }

      return { success: true, ...data };
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithOTP = async (email: string) => {
    // Step 1: Send OTP
    const sendResult = await sendOTP(email, 'login');
    if (!sendResult.success) {
      return sendResult;
    }

    // Return success - the component will handle OTP input
    return { success: true, otpSent: true };
  };

  const completeOTPLogin = async (email: string, code: string) => {
    // Step 2: Verify OTP and complete login
    const verifyResult = await verifyOTP(email, code, 'login');
    
    if (!verifyResult.success) {
      return verifyResult;
    }

    // For production, you might want to create a proper session here
    // For now, we'll return the verification result
    return verifyResult;
  };

  const verifyRegistrationOTP = async (email: string, code: string) => {
    return await verifyOTP(email, code, 'registration');
  };

  const resetPasswordWithOTP = async (email: string) => {
    return await sendOTP(email, 'password_reset');
  };

  const verifyPasswordResetOTP = async (email: string, code: string) => {
    return await verifyOTP(email, code, 'password_reset');
  };

  const registerWithOTP = async (email: string, name: string, phone?: string) => {
    // Step 1: Send OTP for registration
    const sendResult = await sendOTP(email, 'registration', name);
    if (!sendResult.success) {
      return sendResult;
    }

    // Return success - the component will handle OTP input and completion
    return { success: true, otpSent: true };
  };

  const completeOTPRegistration = async (
    email: string, 
    code: string, 
    registrationData: { name: string; password: string; phone?: string }
  ) => {
    // Step 2: Verify OTP 
    const verifyResult = await verifyOTP(email, code, 'registration');
    
    if (!verifyResult.success) {
      return verifyResult;
    }

    // OTP verified, ready for account creation by parent component
    return { success: true, verified: true, ...verifyResult };
  };

  return {
    isLoading,
    sendOTP,
    verifyOTP,
    loginWithOTP,
    completeOTPLogin,
    registerWithOTP,
    completeOTPRegistration,
    verifyRegistrationOTP,
    resetPasswordWithOTP,
    verifyPasswordResetOTP
  };
};