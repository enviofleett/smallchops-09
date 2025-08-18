
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userType: string | null;
  customerAccount: any | null;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signUpWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [customerAccount, setCustomerAccount] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // If user signed in, load their customer account
        if (session?.user) {
          await loadCustomerAccount(session.user.id);
        } else {
          setCustomerAccount(null);
        }
        
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadCustomerAccount(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadCustomerAccount = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading customer account:', error);
      } else if (data) {
        setCustomerAccount(data);
      }
    } catch (error) {
      console.error('Error in loadCustomerAccount:', error);
    }
  };

  const createCustomerAccount = async (user: User, name: string, phone?: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_accounts')
        .insert({
          user_id: user.id,
          name: name || user.email?.split('@')[0] || 'Customer',
          phone: phone || null,
          email_verified: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating customer account:', error);
        throw error;
      }

      setCustomerAccount(data);
      return data;
    } catch (error) {
      console.error('Error in createCustomerAccount:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
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

      if (data.user) {
        // Create customer account
        try {
          await createCustomerAccount(data.user, name, phone);
          toast({
            title: "Registration successful!",
            description: "Welcome to Starters! You can now start ordering.",
          });
          return { success: true, user: data.user };
        } catch (accountError) {
          console.error('Failed to create customer account:', accountError);
          // User was created but customer account failed - still allow them in
          toast({
            title: "Registration successful!",
            description: "Welcome to Starters! You can now start ordering.",
          });
          return { success: true, user: data.user };
        }
      }

      return { success: false, error: "Unknown error occurred" };
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

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });

      return { success: true, user: data.user };
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

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
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      // Clear any stored data
      localStorage.removeItem('restaurant_cart');
      localStorage.removeItem('guest_session');
      localStorage.removeItem('cart_abandonment_tracking');
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        title: "Sign out failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    userType: customerAccount ? 'customer' : null,
    customerAccount,
    signUp,
    signIn,
    login: signIn, // Alias for signIn
    signOut,
    logout: signOut, // Alias for signOut
    signInWithGoogle,
    signUpWithGoogle: signInWithGoogle, // Alias for signInWithGoogle
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
