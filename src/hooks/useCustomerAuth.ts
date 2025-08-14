import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface CustomerAccount {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  date_of_birth?: string;
  email?: string;
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

  // Move helper functions outside useEffect so they can be reused
  const createCustomerAccount = async (userId: string, userEmail: string) => {
    try {
      console.log('🔄 Creating customer account for:', { userId, userEmail });
      
      const { data, error } = await supabase
        .from('customer_accounts')
        .insert({
          user_id: userId,
          email: userEmail.toLowerCase(),
          name: userEmail.split('@')[0], // Basic name from email
          email_verified: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create customer account:', error);
        return null;
      }

      console.log('✅ Customer account created successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error creating customer account:', error);
      return null;
    }
  };

  const loadCustomerAccount = async (userId: string, userEmail?: string) => {
      try {
        console.log('🔍 Loading customer account for user:', { userId, userEmail });
        
        const { data, error } = await supabase
          .from('customer_accounts')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) {
          console.error('❌ Error fetching customer account:', error);
          
          // If account not found, try to create one if we have user data
          if (error.code === 'PGRST116' && userEmail) {
            console.log('🔄 Customer account not found, attempting to create one...');
            return await createCustomerAccount(userId, userEmail);
          }
          return null;
        }
        
        if (!data && userEmail) {
          console.log('🔄 No customer account found, creating new one...');
          return await createCustomerAccount(userId, userEmail);
        }
        
        console.log('✅ Customer account loaded:', data);
        return data;
      } catch (error) {
        console.error('❌ Customer account fetch error:', error);
        
        // Fallback: Try to create account if we have email
        if (userEmail) {
          console.log('🔄 Fallback: Attempting to create customer account...');
          return await createCustomerAccount(userId, userEmail);
        }
        return null;
      }
    };

  useEffect(() => {
    let mounted = true;
    let subscription: any;

    const initializeAuth = async () => {
      try {
        // PRODUCTION FIX: Set up auth state listener with atomic updates
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          
          console.log(`🔄 Auth state change: ${event}`, { 
            hasUser: !!session?.user, 
            email: session?.user?.email,
            timestamp: new Date().toISOString()
          });
          
          if (session?.user) {
            try {
              // Single atomic state update for loading state
              setAuthState(prev => ({ 
                ...prev, 
                user: session.user, 
                session, 
                isLoading: true,
                error: null
              }));

              // Load customer account with enhanced error handling
              const customerAccount = await loadCustomerAccount(session.user.id, session.user.email);
              
              if (!mounted) return;
              
              // Single atomic state update with complete auth state
              const authUpdate = {
                user: session.user,
                session,
                customerAccount,
                isLoading: false,
                isAuthenticated: !!customerAccount,
                error: customerAccount ? null : `Customer profile not found for ${session.user.email}. Please contact support if this persists.`
              };
              
              console.log('✅ Auth state update complete:', { 
                hasAccount: !!customerAccount, 
                isAuthenticated: authUpdate.isAuthenticated, 
                userId: session.user.id,
                email: session.user.email,
                timestamp: new Date().toISOString()
              });
              
              setAuthState(authUpdate);
            } catch (error) {
              console.error('❌ Auth state change error:', error);
              if (mounted) {
                setAuthState(prev => ({
                  ...prev,
                  customerAccount: null,
                  isLoading: false,
                  isAuthenticated: false,
                  error: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
                }));
              }
            }
          } else {
            // Clear state when no session
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
          console.log('🔄 Initial session detected:', initialSession.user.email);
          
          setAuthState(prev => ({ 
            ...prev, 
            user: initialSession.user, 
            session: initialSession, 
            isLoading: true 
          }));

          const customerAccount = await loadCustomerAccount(initialSession.user.id, initialSession.user.email);
          
          if (mounted) {
            const isAuthenticated = !!customerAccount;
            const error = customerAccount ? null : 'Unable to load customer profile. Please try refreshing the page.';
            
            console.log('🔄 Initial customer account load result:', { 
              hasAccount: !!customerAccount, 
              isAuthenticated, 
              userId: initialSession.user.id,
              email: initialSession.user.email 
            });
            
            setAuthState(prev => ({
              ...prev,
              customerAccount,
              isLoading: false,
              isAuthenticated,
              error
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
    if (!authState.session?.user) {
      console.log('🔄 Refresh attempted but no session found');
      return;
    }
    
    console.log('🔄 Refreshing customer account for:', authState.session.user.email);
    
    try {
      const customerAccount = await loadCustomerAccount(
        authState.session.user.id, 
        authState.session.user.email
      );
      
      if (customerAccount) {
        console.log('✅ Account refresh successful');
        setAuthState(prev => ({
          ...prev,
          customerAccount,
          isAuthenticated: true,
          error: null
        }));
      } else {
        console.log('❌ Account refresh failed - no account found/created');
        setAuthState(prev => ({
          ...prev,
          customerAccount: null,
          isAuthenticated: false,
          error: 'Unable to load customer profile. Please contact support.'
        }));
      }
    } catch (error) {
      console.error('❌ Error refreshing customer account:', error);
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to refresh account. Please try again.'
      }));
    }
  };

  const logout = async () => {
    // Clear cart and shopping data before signing out
    localStorage.removeItem('restaurant_cart');
    localStorage.removeItem('guest_session');
    localStorage.removeItem('cart_abandonment_tracking');
    
    // Clear React Query cache (if available)
    try {
      const queryClient = (window as any)?.queryClient;
      if (queryClient && typeof queryClient.clear === 'function') {
        queryClient.clear();
      }
    } catch (error) {
      console.log('Query client not available for clearing');
    }
    
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