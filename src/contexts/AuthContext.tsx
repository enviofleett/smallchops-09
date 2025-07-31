import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { User, AuthState, LoginCredentials } from '../types/auth';
import logger from '../lib/logger';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signUp: (credentials: LoginCredentials & { name: string }) => Promise<void>;
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
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      if (!data) {
        console.log('No profile found for user:', userId);
        return null;
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

  const signUp = async ({ email, password, name }: LoginCredentials & { name: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          name: name,
        },
      },
    });
    if (error) throw error;
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
    logout,
    resetPassword,
    checkUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
