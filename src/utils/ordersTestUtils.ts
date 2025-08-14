// Production Orders Testing Utilities
import { supabase } from '@/integrations/supabase/client';

export interface OrdersTestResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: string;
}

export const testOrdersAccess = async (userEmail: string): Promise<OrdersTestResult> => {
  const timestamp = new Date().toISOString();
  
  try {
    console.log('🧪 Testing orders access for:', userEmail);
    
    // Test 1: Check authentication status
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      return {
        success: false,
        message: 'User not authenticated',
        details: { step: 'authentication_check' },
        timestamp
      };
    }
    
    // Test 2: Test basic database connection
    const { data: testData, error: testError } = await supabase
      .from('orders')
      .select('count')
      .limit(1);
      
    if (testError) {
      return {
        success: false,
        message: `Database connection failed: ${testError.message}`,
        details: { 
          step: 'database_connection', 
          error: testError,
          code: testError.code 
        },
        timestamp
      };
    }
    
    // Test 3: Test orders query with new RLS policy
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, customer_email, status, total_amount')
      .eq('customer_email', userEmail.toLowerCase())
      .limit(5);
      
    if (ordersError) {
      return {
        success: false,
        message: `Orders query failed: ${ordersError.message}`,
        details: { 
          step: 'orders_query', 
          error: ordersError,
          code: ordersError.code,
          hint: ordersError.hint 
        },
        timestamp
      };
    }
    
    // Test 4: Test customer account access
    const { data: customerAccount, error: accountError } = await supabase
      .from('customer_accounts')
      .select('id, email, name')
      .eq('email', userEmail.toLowerCase())
      .maybeSingle();
      
    if (accountError && accountError.code !== 'PGRST116') {
      return {
        success: false,
        message: `Customer account query failed: ${accountError.message}`,
        details: { 
          step: 'customer_account_query', 
          error: accountError,
          code: accountError.code 
        },
        timestamp
      };
    }
    
    return {
      success: true,
      message: `All tests passed successfully! Found ${orders?.length || 0} orders.`,
      details: {
        ordersCount: orders?.length || 0,
        hasCustomerAccount: !!customerAccount,
        customerAccountId: customerAccount?.id,
        authUserId: session.session.user.id,
        allTestsPassed: true
      },
      timestamp
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { 
        step: 'unexpected_error', 
        error: error instanceof Error ? error.stack : error 
      },
      timestamp
    };
  }
};

export const testRealTimeSubscription = async (userEmail: string): Promise<OrdersTestResult> => {
  const timestamp = new Date().toISOString();
  
  return new Promise((resolve) => {
    console.log('🧪 Testing real-time subscription for:', userEmail);
    
    let timeoutId: NodeJS.Timeout;
    let channel: any;
    
    try {
      channel = supabase
        .channel('orders_test_channel')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'orders', filter: `customer_email=eq.${userEmail}` },
          (payload) => {
            console.log('✅ Real-time test received payload:', payload);
            cleanup();
            resolve({
              success: true,
              message: 'Real-time subscription working correctly',
              details: { payload },
              timestamp
            });
          }
        )
        .subscribe((status) => {
          console.log('📡 Real-time subscription status:', status);
          
          if (String(status).includes('SUBSCRIBED')) {
            // Give it 2 seconds to establish connection, then resolve as working
            timeoutId = setTimeout(() => {
              cleanup();
              resolve({
                success: true,
                message: 'Real-time subscription established successfully',
                details: { status: String(status) },
                timestamp
              });
            }, 2000);
          } else if (String(status).includes('ERROR')) {
            cleanup();
            resolve({
              success: false,
              message: 'Real-time subscription failed to establish',
              details: { status: String(status) },
              timestamp
            });
          }
        });
        
      // Cleanup function
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (channel) supabase.removeChannel(channel);
      };
      
      // Overall timeout after 10 seconds
      setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          message: 'Real-time subscription test timed out',
          details: { timeout: '10s' },
          timestamp
        });
      }, 10000);
      
    } catch (error) {
      resolve({
        success: false,
        message: `Real-time test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error },
        timestamp
      });
    }
  });
};