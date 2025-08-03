import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface CustomerAccount {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  date_of_birth?: string;
}

interface CustomerAuthState {
  user: User | null;
  session: Session | null;
  customerAccount: CustomerAccount | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export const useCustomerAuth = () => {
  const [authState, setAuthState] = useState<CustomerAuthState>({
    user: null,
    session: null,
    customerAccount: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    let subscription: any;

    const loadCustomerAccount = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('customer_accounts')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching customer account:', error);
          return null;
        }
        
        return data;
      } catch (error) {
        console.error('Customer account fetch error:', error);
        return null;
      }
    };

    const initializeAuth = async () => {
      try {
        // Set up auth state listener
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          
          if (session?.user) {
            // Use setTimeout to prevent potential Supabase deadlocks
            setTimeout(async () => {
              if (!mounted) return;
              
              setAuthState(prev => ({ 
                ...prev, 
                user: session.user, 
                session, 
                isLoading: true,
                error: null
              }));

              // Load customer account
              const customerAccount = await loadCustomerAccount(session.user.id);
              
              if (mounted) {
                setAuthState(prev => ({
                  ...prev,
                  customerAccount,
                  isLoading: false,
                  isAuthenticated: !!customerAccount,
                  error: customerAccount ? null : 'Customer account not found'
                }));
              }
            }, 0);
          } else {
            setAuthState({
              user: null,
              session: null,
              customerAccount: null,
              isLoading: false,
              isAuthenticated: false,
              error: null,
            });
          }
        });

        subscription = data.subscription;

        // Check for existing session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (initialSession?.user) {
          setAuthState(prev => ({ 
            ...prev, 
            user: initialSession.user, 
            session: initialSession, 
            isLoading: true 
          }));

          const customerAccount = await loadCustomerAccount(initialSession.user.id);
          
          if (mounted) {
            setAuthState(prev => ({
              ...prev,
              customerAccount,
              isLoading: false,
              isAuthenticated: !!customerAccount,
              error: customerAccount ? null : 'Customer account not found'
            }));
          }
        } else {
          if (mounted) {
            setAuthState(prev => ({ ...prev, isLoading: false }));
          }
        }
      } catch (error) {
        console.error('Customer auth initialization error:', error);
        if (mounted) {
          setAuthState(prev => ({ 
            ...prev, 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Authentication initialization failed'
          }));
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const refreshAccount = async () => {
    if (!authState.session?.user) return;
    
    try {
      const { data, error } = await supabase
        .from('customer_accounts')
        .select('*')
        .eq('user_id', authState.session.user.id)
        .maybeSingle();
      
      if (!error && data) {
        setAuthState(prev => ({
          ...prev,
          customerAccount: data,
          isAuthenticated: true,
          error: null
        }));
      }
    } catch (error) {
      console.error('Error refreshing customer account:', error);
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateCustomerAccount = async (updates: Partial<CustomerAccount>) => {
    if (!authState.customerAccount) return;

    const { data, error } = await supabase
      .from('customer_accounts')
      .update(updates)
      .eq('id', authState.customerAccount.id)
      .select()
      .single();

    if (error) throw error;

    setAuthState(prev => ({
      ...prev,
      customerAccount: data,
    }));

    return data;
  };

  return {
    ...authState,
    logout,
    updateCustomerAccount,
    refetch: refreshAccount,
  };
};