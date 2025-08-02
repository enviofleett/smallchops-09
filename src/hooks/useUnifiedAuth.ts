import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useOTPAuth } from '@/hooks/useOTPAuth';
import { useToast } from '@/hooks/use-toast';

interface RegistrationData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

interface UnifiedAuthState {
  isLoading: boolean;
  isOTPRequired: boolean;
  otpEmail: string;
  otpPurpose: 'login' | 'registration' | null;
  tempRegistrationData: RegistrationData | null;
}

export const useUnifiedAuth = () => {
  const [authState, setAuthState] = useState<UnifiedAuthState>({
    isLoading: false,
    isOTPRequired: false,
    otpEmail: '',
    otpPurpose: null,
    tempRegistrationData: null
  });

  const { toast } = useToast();
  
  // Core auth hooks
  const { login: adminLogin, signUp: adminSignUp, signUpWithGoogle, isLoading: adminLoading } = useAuth();
  const { customerAccount, isLoading: customerLoading } = useCustomerAuth();
  const { 
    sendOTP, 
    verifyOTP, 
    loginWithOTP, 
    completeOTPLogin, 
    registerWithOTP,
    completeOTPRegistration,
    isLoading: otpLoading 
  } = useOTPAuth();

  const isLoading = adminLoading || customerLoading || otpLoading || authState.isLoading;

  // Unified login function
  const login = async (email: string, password: string, mode: 'admin' | 'customer') => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      if (mode === 'admin') {
        await adminLogin({ email, password });
        return { success: true, redirect: '/dashboard' };
      } else {
        // Customer login uses OTP
        const result = await loginWithOTP(email);
        if (result.success) {
          setAuthState(prev => ({
            ...prev,
            isOTPRequired: true,
            otpEmail: email,
            otpPurpose: 'login'
          }));
          return { success: true, requiresOTP: true };
        }
        return result;
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Unified registration function
  const register = async (data: RegistrationData, mode: 'admin' | 'customer') => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      if (mode === 'admin') {
        await adminSignUp({
          email: data.email,
          password: data.password,
          name: data.name
        });
        
        toast({
          title: "Registration successful!",
          description: "Please check your email for verification.",
        });
        
        return { success: true, requiresEmailVerification: true };
      } else {
        // Customer registration uses OTP
        const result = await registerWithOTP(data.email, data.name, data.phone);
        if (result.success) {
          setAuthState(prev => ({
            ...prev,
            isOTPRequired: true,
            otpEmail: data.email,
            otpPurpose: 'registration',
            tempRegistrationData: data
          }));
          return { success: true, requiresOTP: true };
        }
        return result;
      }
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Complete OTP verification
  const completeOTPVerification = async (code: string) => {
    if (!authState.otpPurpose || !authState.otpEmail) {
      return { success: false, error: "Invalid OTP state" };
    }

    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      if (authState.otpPurpose === 'login') {
        const result = await completeOTPLogin(authState.otpEmail, code);
        if (result.success) {
          resetOTPState();
          return { success: true, redirect: '/customer-portal' };
        }
        return result;
      } else if (authState.otpPurpose === 'registration' && authState.tempRegistrationData) {
        const verifyResult = await verifyOTP(authState.otpEmail, code, 'registration');
        
        if (verifyResult.success) {
          // Complete account creation
          await adminSignUp({
            email: authState.tempRegistrationData.email,
            password: authState.tempRegistrationData.password,
            name: authState.tempRegistrationData.name,
            phone: authState.tempRegistrationData.phone
          });
          
          toast({
            title: "Registration successful!",
            description: "Welcome! Your account has been created.",
          });
          
          resetOTPState();
          return { success: true, redirect: '/customer-portal' };
        }
        return verifyResult;
      }
      
      return { success: false, error: "Unknown OTP purpose" };
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Handle Google authentication
  const handleGoogleAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      await signUpWithGoogle();
      // Redirect will be handled by AuthCallback
      return { success: true };
    } catch (error: any) {
      toast({
        title: "Google authentication failed",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Reset OTP state
  const resetOTPState = () => {
    setAuthState({
      isLoading: false,
      isOTPRequired: false,
      otpEmail: '',
      otpPurpose: null,
      tempRegistrationData: null
    });
  };

  // Cancel OTP flow
  const cancelOTP = () => {
    resetOTPState();
  };

  return {
    // State
    isLoading,
    isOTPRequired: authState.isOTPRequired,
    otpEmail: authState.otpEmail,
    otpPurpose: authState.otpPurpose,
    tempRegistrationData: authState.tempRegistrationData,
    customerAccount,

    // Actions
    login,
    register,
    completeOTPVerification,
    handleGoogleAuth,
    cancelOTP,
    resetOTPState
  };
};