import { supabase } from '@/integrations/supabase/client';

export interface TestResult {
  step: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export interface UserStatusDetails {
  auth_user_exists: boolean;
  customer_record_exists: boolean;
  customer_account_exists: boolean;
  profile_exists: boolean;
  welcome_email_queued: boolean;
  communication_events: any[];
  customer_data?: any;
  profile_data?: any;
}

export interface UserStatus {
  status: 'complete' | 'partial' | 'missing' | 'error';
  details: UserStatusDetails;
  message?: string;
}

class RegistrationDebugService {
  async runSystemTest(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
      // Test 1: Database connectivity
      results.push(await this.testDatabaseConnection());
      
      // Test 2: Registration system components
      results.push(await this.testRegistrationComponents());
      
      // Test 3: Communication system
      results.push(await this.testCommunicationSystem());
      
      // Test 4: Authentication triggers
      results.push(await this.testAuthTriggers());
      
      // Test 5: RLS policies
      results.push(await this.testRLSPolicies());

    } catch (error) {
      results.push({
        step: 'system_test_error',
        status: 'fail',
        message: 'System test failed to complete',
        details: error
      });
    }

    return results;
  }

  private async testDatabaseConnection(): Promise<TestResult> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('count')
        .limit(1);

      if (error) {
        return {
          step: 'database_connection',
          status: 'fail',
          message: 'Database connection failed',
          details: error
        };
      }

      return {
        step: 'database_connection',
        status: 'pass',
        message: 'Database connection successful'
      };
    } catch (error) {
      return {
        step: 'database_connection',
        status: 'fail',
        message: 'Database connection error',
        details: error
      };
    }
  }

  private async testRegistrationComponents(): Promise<TestResult> {
    try {
      // Test if required functions exist
      const { data, error } = await supabase.rpc('test_registration_system');

      if (error) {
        return {
          step: 'registration_components',
          status: 'fail',
          message: 'Registration test function failed',
          details: error
        };
      }

      const failedTests = data?.filter((test: any) => test.status === 'fail') || [];
      const warnings = data?.filter((test: any) => test.status === 'warning') || [];

      if (failedTests.length > 0) {
        return {
          step: 'registration_components',
          status: 'fail',
          message: `${failedTests.length} critical registration components failed`,
          details: data
        };
      }

      if (warnings.length > 0) {
        return {
          step: 'registration_components',
          status: 'warning',
          message: `${warnings.length} registration components have warnings`,
          details: data
        };
      }

      return {
        step: 'registration_components',
        status: 'pass',
        message: 'All registration components operational',
        details: data
      };
    } catch (error) {
      return {
        step: 'registration_components',
        status: 'fail',
        message: 'Registration components test error',
        details: error
      };
    }
  }

  private async testCommunicationSystem(): Promise<TestResult> {
    try {
      // Check recent communication events
      const { data: events, error } = await supabase
        .from('communication_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return {
          step: 'communication_system',
          status: 'fail',
          message: 'Communication events query failed',
          details: error
        };
      }

      const recentFailed = events?.filter(event => 
        event.status === 'failed' && 
        new Date(event.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ) || [];

      if (recentFailed.length > 5) {
        return {
          step: 'communication_system',
          status: 'fail',
          message: `${recentFailed.length} failed communications in last 24h`,
          details: { recentFailed, totalEvents: events?.length }
        };
      }

      if (recentFailed.length > 0) {
        return {
          step: 'communication_system',
          status: 'warning',
          message: `${recentFailed.length} failed communications in last 24h`,
          details: { recentFailed, totalEvents: events?.length }
        };
      }

      return {
        step: 'communication_system',
        status: 'pass',
        message: 'Communication system healthy',
        details: { totalEvents: events?.length }
      };
    } catch (error) {
      return {
        step: 'communication_system',
        status: 'fail',
        message: 'Communication system test error',
        details: error
      };
    }
  }

  private async testAuthTriggers(): Promise<TestResult> {
    try {
      // Check if trigger exists
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('category', 'Authentication')
        .order('event_time', { ascending: false })
        .limit(5);

      if (error && error.code !== 'PGRST116') { // Not "no rows" error
        return {
          step: 'auth_triggers',
          status: 'fail',
          message: 'Auth trigger check failed',
          details: error
        };
      }

      return {
        step: 'auth_triggers',
        status: 'pass',
        message: 'Auth triggers accessible',
        details: { recentLogs: data?.length || 0 }
      };
    } catch (error) {
      return {
        step: 'auth_triggers',
        status: 'warning',
        message: 'Auth triggers test inconclusive',
        details: error
      };
    }
  }

  private async testRLSPolicies(): Promise<TestResult> {
    try {
      // Test basic RLS by querying protected table
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('count')
        .limit(1);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (customerError && profileError) {
        return {
          step: 'rls_policies',
          status: 'fail',
          message: 'RLS policies blocking access inappropriately',
          details: { customerError, profileError }
        };
      }

      return {
        step: 'rls_policies',
        status: 'pass',
        message: 'RLS policies functioning correctly'
      };
    } catch (error) {
      return {
        step: 'rls_policies',
        status: 'warning',
        message: 'RLS policies test inconclusive',
        details: error
      };
    }
  }

  async checkUserStatus(email: string): Promise<UserStatus> {
    try {
      const details: UserStatusDetails = {
        auth_user_exists: false,
        customer_record_exists: false,
        customer_account_exists: false,
        profile_exists: false,
        welcome_email_queued: false,
        communication_events: []
      };

      // Check customer record
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (!customerError && customer) {
        details.customer_record_exists = true;
        details.customer_data = customer;
        details.auth_user_exists = !!customer.user_id;
      }

      // Check communication events
      const { data: events } = await supabase
        .from('communication_events')
        .select('*')
        .eq('recipient_email', email.toLowerCase())
        .order('created_at', { ascending: false });

      if (events) {
        details.communication_events = events;
        details.welcome_email_queued = events.some(e => 
          e.event_type === 'customer_welcome' && 
          ['queued', 'processing', 'sent'].includes(e.status)
        );
      }

      // Check profile if user_id exists
      if (customer?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', customer.user_id)
          .maybeSingle();

        if (profile) {
          details.profile_exists = true;
          details.profile_data = profile;
        }

        // Check customer account
        const { data: account } = await supabase
          .from('customer_accounts')
          .select('*')
          .eq('user_id', customer.user_id)
          .maybeSingle();

        details.customer_account_exists = !!account;
      }

      // Determine overall status
      let status: UserStatus['status'] = 'missing';
      let message = '';

      if (details.auth_user_exists && details.customer_record_exists) {
        status = 'complete';
        message = 'User registration completed successfully';
      } else if (details.customer_record_exists) {
        status = 'partial';
        message = 'Customer record exists but missing auth user';
      } else {
        status = 'missing';
        message = 'No registration found for this email';
      }

      return { status, details, message };

    } catch (error) {
      return {
        status: 'error',
        details: {
          auth_user_exists: false,
          customer_record_exists: false,
          customer_account_exists: false,
          profile_exists: false,
          welcome_email_queued: false,
          communication_events: []
        },
        message: `Error checking user status: ${error}`
      };
    }
  }

  async getLogs(category?: string, limit: number = 50): Promise<any[]> {
    try {
      let query = supabase
        .from('debug_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching logs:', error);
      return [];
    }
  }

  async logDebug(message: string, level: 'info' | 'warn' | 'error' = 'info', details?: any): Promise<void> {
    try {
      await supabase.functions.invoke('log-registration-debug', {
        body: {
          message,
          level,
          category: 'registration',
          details: details || {}
        }
      });
    } catch (error) {
      console.error('Failed to log debug message:', error);
    }
  }
}

export const useRegistrationDebug = () => {
  const service = new RegistrationDebugService();
  
  return {
    runSystemTest: () => service.runSystemTest(),
    checkUserStatus: (email: string) => service.checkUserStatus(email),
    getLogs: (category?: string, limit?: number) => service.getLogs(category, limit),
    logDebug: (message: string, level?: 'info' | 'warn' | 'error', details?: any) => 
      service.logDebug(message, level, details)
  };
};