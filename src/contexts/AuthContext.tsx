import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { User, AuthState, LoginCredentials } from '../types/auth';
import logger from '../lib/logger';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signUp: (credentials: LoginCredentials & { name: string; phone?: string }) => Promise<void>;
  signUpWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  session: Session | null;
  checkUser: () => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            logger.debug('Auth state change:', event, session?.user?.id);
            
            if (!mounted) return;
            
            setSession(session);
            
            if (session?.user) {
              // Defer profile fetch to avoid blocking auth state changes
              setTimeout(async () => {
                if (mounted) {
                  const profile = await getProfile(session.user.id);
                  if (mounted) {
                    setUser(profile);
                    setIsLoading(false);
                  }
                }
              }, 0);
            } else {
              setUser(null);
              setIsLoading(false);
            }
          }
        );

        // THEN check for existing session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (initialSession?.user) {
          setSession(initialSession);
          const profile = await getProfile(initialSession.user.id);
          if (mounted) {
            setUser(profile);
          }
        }
        
        if (mounted) {
          setIsLoading(false);
        }

        return () => {
          mounted = false;
          subscription?.unsubscribe();
        };
      } catch (error: any) {
        logger.error('Auth initialization error:', error, 'AuthContext');
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

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
        const profile = await getProfile(currentSession.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async ({ email, password }: LoginCredentials) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async ({ email, password, name, phone }: LoginCredentials & { name: string; phone?: string }) => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const userData: Record<string, any> = { 
        name, 
        full_name: name,
        user_type: 'customer' // Explicitly mark as customer registration
      };
      
      if (phone && phone.trim()) {
        userData.phone = phone;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: userData,
        },
      });

      if (error) {
        // Log security incident for failed registrations
        await supabase.rpc('log_security_incident', {
          p_incident_type: 'registration_failure',
          p_severity: 'medium',
          p_endpoint: '/auth/signup',
          p_details: {
            email: email,
            error: error.message
          }
        });
        
        throw error;
      }

      toast({
        title: "Registration successful!",
        description: "Please check your email to verify your account.",
      });
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw error;
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) throw error;
  };

  const value = {
    session,
    user,
    isAuthenticated: !!session?.user,
    isLoading,
    login,
    signUp,
    signUpWithGoogle,
    logout,
    resetPassword,
    checkUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
