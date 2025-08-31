
import { supabase } from '@/integrations/supabase/client';

export interface ProductionHealthCheck {
  smtpHealth: {
    configured: boolean;
    authenticated: boolean;
    errors: string[];
  };
  databaseHealth: {
    ordersConstraints: boolean;
    riderAssignments: boolean;
    errors: string[];
  };
  overallStatus: 'healthy' | 'warning' | 'critical';
}

export const verifyProductionHealth = async (): Promise<ProductionHealthCheck> => {
  const health: ProductionHealthCheck = {
    smtpHealth: {
      configured: false,
      authenticated: false,
      errors: []
    },
    databaseHealth: {
      ordersConstraints: false,
      riderAssignments: false,
      errors: []
    },
    overallStatus: 'healthy'
  };

  try {
    // Check SMTP health
    console.log('🔍 Checking SMTP health...');
    const { data: smtpResult } = await supabase.functions.invoke('smtp-auth-healthcheck', {
      body: { action: 'health_check' }
    });

    if (smtpResult?.success) {
      health.smtpHealth.configured = true;
      health.smtpHealth.authenticated = smtpResult.auth_success;
      if (!smtpResult.auth_success) {
        health.smtpHealth.errors.push('SMTP authentication failed');
      }
    } else {
      health.smtpHealth.errors.push('SMTP health check failed');
    }

    // Check database constraints
    console.log('🔍 Checking database constraints...');
    const { data: constraintCheck, error: constraintError } = await supabase
      .from('orders')
      .select('id')
      .not('assigned_rider_id', 'is', null)
      .limit(1);

    if (!constraintError) {
      health.databaseHealth.ordersConstraints = true;
    } else {
      health.databaseHealth.errors.push(`Orders constraint check failed: ${constraintError.message}`);
    }

    // Check rider assignments functionality
    console.log('🔍 Checking rider assignments...');
    const { data: activeRiders, error: ridersError } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (!ridersError && activeRiders && activeRiders.length > 0) {
      health.databaseHealth.riderAssignments = true;
    } else {
      health.databaseHealth.errors.push('No active riders found or riders query failed');
    }

  } catch (error) {
    console.error('❌ Production health check failed:', error);
    health.databaseHealth.errors.push(`Health check error: ${error.message}`);
  }

  // Determine overall status
  const hasErrors = health.smtpHealth.errors.length > 0 || health.databaseHealth.errors.length > 0;
  const hasCriticalIssues = !health.smtpHealth.configured || !health.databaseHealth.ordersConstraints;

  if (hasCriticalIssues) {
    health.overallStatus = 'critical';
  } else if (hasErrors) {
    health.overallStatus = 'warning';
  } else {
    health.overallStatus = 'healthy';
  }

  console.log('📊 Production health check complete:', health.overallStatus);
  return health;
};
