import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { User, AuthState, LoginCredentials } from '../types/auth';
import logger from '../lib/logger';
import { useToast } from '@/hooks/use-toast';

interface CustomerAccount {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  email?: string;
  date_of_birth?: string;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; redirect?: string; error?: string }>;
  signUp: (credentials: LoginCredentials & { name: string; phone?: string }) => Promise<{ success: boolean; requiresEmailVerification?: boolean; error?: string }>;
  signUpWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  session: Session | null;
  checkUser: () => Promise<void>;
  userType: 'admin' | 'customer' | null;
  customerAccount: CustomerAccount | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [customerAccount, setCustomerAccount] = useState<CustomerAccount | null>(null);
  const [userType, setUserType] = useState<'admin' | 'customer' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const initializeAuth = async () => {
      try {
        // Set up auth state listener with optimized handling
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (!mounted) return;
            
            // Only sync state updates here - no async operations
            setSession(session);
            
            if (session?.user) {
              // Defer async operations to prevent blocking
              setTimeout(() => {
                if (mounted) {
                  loadUserData(session.user).finally(() => {
                    if (mounted) setIsLoading(false);
                  });
                }
              }, 0);
            } else {
              setUser(null);
              setCustomerAccount(null);
              setUserType(null);
              setIsLoading(false);
            }
          }
        );

        unsubscribe = () => subscription?.unsubscribe();

        // Check for existing session with timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session check timeout')), 5000);
        });

        try {
          const { data: { session: initialSession } } = await Promise.race([
            sessionPromise,
            timeoutPromise
          ]) as any;
          
          if (!mounted) return;

          if (initialSession?.user) {
            setSession(initialSession);
            await loadUserData(initialSession.user);
          }
        } catch (timeoutError) {
          logger.warn('Session check timed out, proceeding without session');
        }
        
        if (mounted) {
          setIsLoading(false);
        }

      } catch (error: any) {
        logger.error('Auth initialization error:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const loadUserData = async (authUser: SupabaseUser) => {
    try {
      // First check if user is admin (has profile)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profile) {
        // Admin user
        setUser({
          id: profile.id,
          name: profile.name || '',
          role: profile.role,
          avatar_url: profile.avatar_url,
          email: authUser.email || '',
        });
        setUserType('admin');
        setCustomerAccount(null);
        return;
      }

      // Check if user is customer (has customer account)
      const { data: customerAcc } = await supabase
        .from('customer_accounts')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (customerAcc) {
        // Customer user
        setCustomerAccount(customerAcc);
        setUserType('customer');
        setUser(null);
        return;
      }

      // New user - determine type based on metadata or email
      const isAdminEmail = authUser.email?.includes('admin') || authUser.user_metadata?.role;
      
      if (isAdminEmail) {
        // Create admin profile
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Admin',
            email: authUser.email,
            role: 'admin'
          })
          .select()
          .single();

        if (newProfile) {
          setUser({
            id: newProfile.id,
            name: newProfile.name,
            role: newProfile.role,
            avatar_url: newProfile.avatar_url,
            email: authUser.email || '',
          });
          setUserType('admin');
        }
      } else {
        // Create customer account with enhanced Google profile data
        const customerName = authUser.user_metadata?.full_name || 
                           authUser.user_metadata?.name || 
                           `${authUser.user_metadata?.first_name || ''} ${authUser.user_metadata?.last_name || ''}`.trim() ||
                           authUser.email?.split('@')[0] || 'Customer';
                           
        const { data: newCustomer } = await supabase
          .from('customer_accounts')
          .insert({
            user_id: authUser.id,
            name: customerName,
            phone: authUser.user_metadata?.phone,
            email: authUser.email
          })
          .select()
          .single();

        if (newCustomer) {
          setCustomerAccount(newCustomer);
          setUserType('customer');
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const getProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*`)
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error);
        // Create a basic profile for new users instead of returning null
        const { data: { user: authUser } } = await supabase.auth.getUser();
        return {
          id: userId,
          name: authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || 'User',
          role: 'admin',
          avatar_url: null,
          email: authUser?.email || '',
        };
      }

      if (!data) {
        console.log('No profile found for user, creating fallback:', userId);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        return {
          id: userId,
          name: authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || 'User',
          role: 'admin',
          avatar_url: null,
          email: authUser?.email || '',
        };
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();

      return {
        id: data.id,
        name: data.name || '',
        role: data.role,
        avatar_url: data.avatar_url,
        email: authUser?.email || '',
      };
    } catch (error) {
      console.error('Profile fetch error:', error);
      return null;
    }
  };

  const checkUser = async () => {
    setIsLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession?.user) {
        await loadUserData(currentSession.user);
      } else {
        setUser(null);
        setCustomerAccount(null);
        setUserType(null);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
      setCustomerAccount(null);
      setUserType(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async ({ email, password }: LoginCredentials) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error('Login error:', error);
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Load user data to determine correct redirect
        await loadUserData(data.user);
        
        // Check if user is admin by checking profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        
        const redirectPath = profile ? '/dashboard' : '/';
        return { success: true, redirect: redirectPath };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const signUp = async ({ email, password, name, phone }: LoginCredentials & { name: string; phone?: string }) => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const userData: Record<string, any> = { 
        name, 
        full_name: name,
        user_type: 'customer'
      };
      
      if (phone && phone.trim()) {
        userData.phone = phone;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: userData,
        },
      });

      if (error) {
        console.error('Sign up error:', error);
        toast({
          title: "Registration failed",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }

      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "Registration successful!",
          description: "Please check your email to verify your account.",
        });
        return { success: true, requiresEmailVerification: true };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  };

  const resendOtp = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) {
        console.error('Resend OTP error:', error);
        toast({
          title: "Failed to resend email",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      return { success: false, error: error.message };
    }
  };

  const signUpWithGoogle = async () => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        // Log OAuth error
        await supabase.rpc('log_security_incident', {
          p_incident_type: 'oauth_failure',
          p_severity: 'medium',
          p_endpoint: '/auth/google',
          p_details: {
            provider: 'google',
            error: error.message
          }
        });
        
        throw error;
      }
    } catch (error: any) {
      console.error('Google sign up error:', error);
      toast({
        title: "Google sign up failed",
        description: error.message || "Please try again or use email registration.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const send = () => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` });
    let { error } = await send();
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('timeout') || msg.includes('context deadline exceeded') || msg.includes('504')) {
        await new Promise((r) => setTimeout(r, 1500));
        const retry = await send();
        if (!retry.error) return;
      }
      throw error;
    }
  };

  const value = {
    session,
    user,
    customerAccount,
    userType,
    isAuthenticated: !!session?.user,
    isLoading,
    login,
    signUp,
    signUpWithGoogle,
    logout,
    resetPassword,
    resendOtp,
    checkUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
