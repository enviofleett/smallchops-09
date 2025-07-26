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
}

export const useCustomerAuth = () => {
  const [authState, setAuthState] = useState<CustomerAuthState>({
    user: null,
    session: null,
    customerAccount: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Customer auth state change:', event, session?.user?.id);
            
            if (!mounted) return;
            
            if (session?.user) {
              // Get customer account
              setTimeout(async () => {
                if (mounted) {
                  const customerAccount = await getCustomerAccount(session.user.id);
                  if (mounted) {
                    setAuthState({
                      user: session.user,
                      session,
                      customerAccount,
                      isLoading: false,
                      isAuthenticated: !!customerAccount,
                    });
                  }
                }
              }, 0);
            } else {
              setAuthState({
                user: null,
                session: null,
                customerAccount: null,
                isLoading: false,
                isAuthenticated: false,
              });
            }
          }
        );

        // Check for existing session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (initialSession?.user) {
          const customerAccount = await getCustomerAccount(initialSession.user.id);
          if (mounted) {
            setAuthState({
              user: initialSession.user,
              session: initialSession,
              customerAccount,
              isLoading: false,
              isAuthenticated: !!customerAccount,
            });
          }
        } else {
          if (mounted) {
            setAuthState(prev => ({ ...prev, isLoading: false }));
          }
        }

        return () => {
          mounted = false;
          subscription?.unsubscribe();
        };
      } catch (error) {
        console.error('Customer auth initialization error:', error);
        if (mounted) {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const getCustomerAccount = async (userId: string): Promise<CustomerAccount | null> => {
    try {
      const { data, error } = await supabase
        .from('customer_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();
      
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
    getCustomerAccount,
  };
};