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
        // Set up auth state listener - CRITICAL: No Supabase calls inside this callback
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
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

              // Defer async operations to prevent deadlock
              setTimeout(() => {
                if (!mounted) return;
                
                getCustomerAccountWithRetry(session.user.id).then(customerAccount => {
                  if (mounted) {
                    setAuthState(prev => ({
                      ...prev,
                      customerAccount,
                      isLoading: false,
                      isAuthenticated: !!customerAccount,
                      error: customerAccount ? null : 'Customer account not found'
                    }));

                    // Trigger instant welcome email processing for new OAuth users
                    if (event === 'SIGNED_IN' && session.user.app_metadata?.provider === 'google') {
                      setTimeout(() => {
                        supabase.functions.invoke('instant-welcome-processor').then(({ error: processError }) => {
                          if (processError) {
                            console.warn('Welcome email processing warning:', processError);
                          } else {
                            console.log('✅ Welcome email processing triggered successfully');
                          }
                        }).catch(error => {
                          console.warn('Welcome email processing error:', error);
                        });
                      }, 3000);
                    }
                  }
                }).catch(error => {
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
                });
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
          // If customer account doesn't exist yet, try to create it
          if (error.code === 'PGRST116') {
            console.log(`Customer account not found for user ${userId}, attempting to create...`);
            
            try {
              const { data: createResult, error: createError } = await supabase.rpc(
                'create_missing_customer_account',
                { p_user_id: userId }
              );

              if (createError) {
                console.error('Error creating customer account:', createError);
                if (attempt < maxRetries - 1) {
                  const delay = Math.pow(2, attempt) * 1000;
                  console.log(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                }
                return null;
              }

              if (createResult && typeof createResult === 'object' && 'success' in createResult && createResult.success) {
                console.log('✅ Customer account created successfully');
                // Retry fetching the account
                const { data: newData, error: newError } = await supabase
                  .from('customer_accounts')
                  .select('*')
                  .eq('user_id', userId)
                  .single();
                
                if (!newError && newData) {
                  return newData;
                }
              }
            } catch (createErr) {
              console.error('Failed to create customer account:', createErr);
            }
            
            // If creation failed and we have retries left
            if (attempt < maxRetries - 1) {
              const delay = Math.pow(2, attempt) * 1000;
              console.log(`Account creation failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
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