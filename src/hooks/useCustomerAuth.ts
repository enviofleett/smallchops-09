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

    const initializeAuth = async () => {
      try {
        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Customer auth state change:', event, session?.user?.id);
            
            if (!mounted) return;
            
            if (session?.user) {
              setAuthState(prev => ({ 
                ...prev, 
                user: session.user, 
                session, 
                isLoading: true,
                error: null
              }));

              try {
                const customerAccount = await getCustomerAccountWithRetry(session.user.id);
                if (mounted) {
                  setAuthState(prev => ({
                    ...prev,
                    customerAccount,
                    isLoading: false,
                    isAuthenticated: !!customerAccount,
                    error: customerAccount ? null : 'Customer account not found'
                  }));
                }
              } catch (error) {
                console.error('Error loading customer account:', error);
                if (mounted) {
                  setAuthState(prev => ({
                    ...prev,
                    customerAccount: null,
                    isLoading: false,
                    isAuthenticated: false,
                    error: error instanceof Error ? error.message : 'Failed to load customer account'
                  }));
                }
              }
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
          }
        );

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

          try {
            const customerAccount = await getCustomerAccountWithRetry(initialSession.user.id);
            if (mounted) {
              setAuthState(prev => ({
                ...prev,
                customerAccount,
                isLoading: false,
                isAuthenticated: !!customerAccount,
                error: customerAccount ? null : 'Customer account not found'
              }));
            }
          } catch (error) {
            console.error('Error loading customer account on init:', error);
            if (mounted) {
              setAuthState(prev => ({
                ...prev,
                customerAccount: null,
                isLoading: false,
                isAuthenticated: false,
                error: error instanceof Error ? error.message : 'Failed to load customer account'
              }));
            }
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
    };
  }, []);

  const getCustomerAccountWithRetry = async (userId: string, maxRetries = 3): Promise<CustomerAccount | null> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('customer_accounts')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (error) {
          // If customer account doesn't exist yet (common for new registrations), retry with exponential backoff
          if (error.code === 'PGRST116' && attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            console.log(`Customer account not found yet, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          console.error('Error fetching customer account:', error);
          return null;
        }

        return data;
      } catch (error) {
        console.error(`Customer account fetch error (attempt ${attempt + 1}):`, error);
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // Wait before retrying
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return null;
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
    refetch: () => {
      if (authState.session?.user) {
        getCustomerAccountWithRetry(authState.session.user.id);
      }
    },
  };
};