
import { useState, useCallback } from 'react';
import { useCustomerDirectAuth } from './useCustomerDirectAuth';
import { useToast } from './use-toast';

interface RegistrationData {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export const useRegistrationFlow = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'verification' | 'success'>('form');
  const [registrationEmail, setRegistrationEmail] = useState<string>('');
  
  const { register, resendOtp } = useCustomerDirectAuth();
  const { toast } = useToast();

  const handleRegister = useCallback(async (data: RegistrationData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await register(data);
      
      if (result.success) {
        setRegistrationEmail(data.email);
        if (result.requiresEmailVerification) {
          setStep('verification');
          toast({
            title: "Check your email",
            description: "We've sent you a verification link. Please check your inbox.",
          });
        } else {
          setStep('success');
          toast({
            title: "Registration successful!",
            description: "Welcome! You can now start shopping.",
          });
        }
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [register, toast]);

  const handleResendVerification = useCallback(async () => {
    if (!registrationEmail) return;
    
    setIsLoading(true);
    try {
      const result = await resendOtp(registrationEmail);
      if (result.success) {
        toast({
          title: "Email sent",
          description: "We've sent another verification email to your inbox.",
        });
      } else {
        setError(result.error || 'Failed to resend verification email');
      }
    } catch (err) {
      setError('Failed to resend verification email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [registrationEmail, resendOtp, toast]);

  const resetFlow = useCallback(() => {
    setStep('form');
    setError(null);
    setRegistrationEmail('');
    setIsLoading(false);
  }, []);

  const retryRegistration = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    error,
    step,
    registrationEmail,
    handleRegister,
    handleResendVerification,
    resetFlow,
    retryRegistration
  };
};
