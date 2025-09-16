import { supabase } from '@/integrations/supabase/client';

export interface SystemHealthStatus {
  database: 'healthy' | 'degraded' | 'down';
  authentication: 'healthy' | 'degraded' | 'down';
  paymentSystem: 'healthy' | 'degraded' | 'down';
  overall: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  details: {
    database?: string;
    authentication?: string;
    paymentSystem?: string;
  };
}

export const checkSystemHealth = async (): Promise<SystemHealthStatus> => {
  const timestamp = new Date().toISOString();
  const details: SystemHealthStatus['details'] = {};
  
  let database: SystemHealthStatus['database'] = 'healthy';
  let authentication: SystemHealthStatus['authentication'] = 'healthy';
  let paymentSystem: SystemHealthStatus['paymentSystem'] = 'healthy';

  // Check database connectivity
  try {
    const { error } = await supabase
      .from('business_info')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    if (error) {
      database = 'degraded';
      details.database = error.message;
    }
  } catch (error) {
    database = 'down';
    details.database = error instanceof Error ? error.message : 'Database connection failed';
  }

  // Check authentication
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session) {
      authentication = 'degraded';
      details.authentication = 'No active session';
    }
  } catch (error) {
    authentication = 'down';
    details.authentication = error instanceof Error ? error.message : 'Auth service unavailable';
  }

  // Check payment system (basic connectivity test)
  try {
    const { error } = await supabase
      .from('payment_transactions')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    if (error) {
      paymentSystem = 'degraded';
      details.paymentSystem = error.message;
    }
  } catch (error) {
    paymentSystem = 'down';
    details.paymentSystem = error instanceof Error ? error.message : 'Payment system unavailable';
  }

  // Determine overall status
  const statuses = [database, authentication, paymentSystem];
  const overall: SystemHealthStatus['overall'] = statuses.includes('down') 
    ? 'down' 
    : statuses.includes('degraded') 
      ? 'degraded' 
      : 'healthy';

  return {
    database,
    authentication,
    paymentSystem,
    overall,
    timestamp,
    details
  };
};

export const logSystemHealth = async (healthStatus: SystemHealthStatus): Promise<void> => {
  try {
    await supabase.from('audit_logs').insert({
      action: 'system_health_check',
      category: 'System Monitoring',
      message: `System health check: ${healthStatus.overall}`,
      new_values: healthStatus as any
    });
  } catch (error) {
    console.error('Failed to log system health:', error);
  }
};