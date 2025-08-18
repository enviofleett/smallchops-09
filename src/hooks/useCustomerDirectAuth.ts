
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface RegistrationData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export const useCustomerDirectAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await signIn(email, password);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegistrationData) => {
    setIsLoading(true);
    try {
      const result = await signUp(data.email, data.password, data.name, data.phone);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithGoogle = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    login,
    register,
    signUpWithGoogle
  };
};
