
import { useState, useCallback } from 'react';
import { useCustomerDirectAuth } from './useCustomerDirectAuth';
import { useToast } from './use-toast';

interface RegistrationData {
  name: string;
  email: string;
  password: string;
  phone: string;
}

interface RegistrationFlowState {
  isLoading: boolean;
  error: string | null;
  step: 'form' | 'verification' | 'success';
  registrationEmail: string;
}

interface RegistrationResult {
  success: boolean;
  requiresEmailVerification?: boolean;
  error?: string;
  user?: any;
  email?: string;
}

export const useRegistrationFlow = () => {
  const [state, setState] = useState<RegistrationFlowState>({
    isLoading: false,
    error: null,
    step: 'form',
    registrationEmail: ''
  });
  
  const { register, resendOtp } = useCustomerDirectAuth();
  const { toast } = useToast();

  const handleRegister = useCallback(async (data: RegistrationData): Promise<RegistrationResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Client-side validation
      if (!data.name?.trim()) {
        const error = 'Full name is required';
        setState(prev => ({ ...prev, error, isLoading: false }));
        return { success: false, error };
      }
      
      if (!data.email?.trim()) {
        const error = 'Email address is required';
        setState(prev => ({ ...prev, error, isLoading: false }));
        return { success: false, error };
      }
      
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        const error = 'Please enter a valid email address';
        setState(prev => ({ ...prev, error, isLoading: false }));
        return { success: false, error };
      }
      
      if (!data.phone?.trim()) {
        const error = 'Phone number is required';
        setState(prev => ({ ...prev, error, isLoading: false }));
        return { success: false, error };
      }
      
      if (!data.password?.trim()) {
        const error = 'Password is required';
        setState(prev => ({ ...prev, error, isLoading: false }));
        return { success: false, error };
      }

      const result = await register(data);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          registrationEmail: data.email,
          isLoading: false,
          error: null
        }));

        if (result.requiresEmailVerification) {
          setState(prev => ({ ...prev, step: 'verification' }));
          toast({
            title: "Check your email",
            description: "We've sent you a verification link. Please check your inbox.",
          });
        } else {
          setState(prev => ({ ...prev, step: 'success' }));
          toast({
            title: "Registration successful!",
            description: "Welcome! You can now start shopping.",
          });
        }
      } else {
        setState(prev => ({ 
          ...prev, 
          error: result.error || 'Registration failed',
          isLoading: false
        }));
      }

      return result;
    } catch (err) {
      console.error('Registration error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        isLoading: false
      }));
      return { success: false, error: errorMessage };
    }
  }, [register, toast]);

  const handleResendVerification = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!state.registrationEmail) {
      const error = 'No email address found for resending verification';
      setState(prev => ({ ...prev, error }));
      return { success: false, error };
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await resendOtp(state.registrationEmail);
      
      if (result.success) {
        toast({
          title: "Email sent",
          description: "We've sent another verification email to your inbox.",
        });
        setState(prev => ({ ...prev, isLoading: false }));
      } else {
        setState(prev => ({ 
          ...prev, 
          error: result.error || 'Failed to resend verification email',
          isLoading: false
        }));
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend verification email. Please try again.';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        isLoading: false
      }));
      return { success: false, error: errorMessage };
    }
  }, [state.registrationEmail, resendOtp, toast]);

  const resetFlow = useCallback(() => {
    setState({
      step: 'form',
      error: null,
      registrationEmail: '',
      isLoading: false
    });
  }, []);

  const retryRegistration = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      error: null,
      isLoading: false
    }));
  }, []);

  return {
    isLoading: state.isLoading,
    error: state.error,
    step: state.step,
    registrationEmail: state.registrationEmail,
    handleRegister,
    handleResendVerification,
    resetFlow,
    retryRegistration
  };
};
