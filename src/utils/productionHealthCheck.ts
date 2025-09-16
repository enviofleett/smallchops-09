/**
 * Production health check utilities for critical admin functions
 * Monitors system stability and prevents cascade failures
 */

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    lastChecked: Date;
  }[];
  summary: string;
}

class ProductionHealthChecker {
  private static instance: ProductionHealthChecker;
  private checkResults: Map<string, any> = new Map();
  private lastFullCheck: Date | null = null;
  
  static getInstance(): ProductionHealthChecker {
    if (!ProductionHealthChecker.instance) {
      ProductionHealthChecker.instance = new ProductionHealthChecker();
    }
    return ProductionHealthChecker.instance;
  }
  
  async runHealthCheck(): Promise<HealthCheckResult> {
    const checks = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Check 1: Admin Orders Manager Function
    try {
      const adminCheck = await this.checkAdminOrdersManager();
      checks.push(adminCheck);
      if (adminCheck.status === 'fail') overallStatus = 'unhealthy';
      else if (adminCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';
    } catch (error) {
      checks.push({
        name: 'Admin Orders Manager',
        status: 'fail' as const,
        message: `Function check failed: ${error.message}`,
        lastChecked: new Date()
      });
      overallStatus = 'unhealthy';
    }
    
    // Check 2: Delivery Schedule Recovery
    try {
      const recoveryCheck = await this.checkScheduleRecovery();
      checks.push(recoveryCheck);
      if (recoveryCheck.status === 'fail') overallStatus = 'unhealthy';
      else if (recoveryCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';
    } catch (error) {
      checks.push({
        name: 'Schedule Recovery',
        status: 'fail' as const,
        message: `Recovery check failed: ${error.message}`,
        lastChecked: new Date()
      });
      overallStatus = 'unhealthy';
    }
    
    // Check 3: Database Connection
    try {
      const dbCheck = await this.checkDatabaseHealth();
      checks.push(dbCheck);
      if (dbCheck.status === 'fail') overallStatus = 'unhealthy';
      else if (dbCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';
    } catch (error) {
      checks.push({
        name: 'Database Connection',
        status: 'fail' as const,
        message: `Database check failed: ${error.message}`,
        lastChecked: new Date()
      });
      overallStatus = 'unhealthy';
    }
    
    this.lastFullCheck = new Date();
    
    const failedChecks = checks.filter(c => c.status === 'fail').length;
    const warnChecks = checks.filter(c => c.status === 'warn').length;
    
    let summary = `${checks.length} checks completed. `;
    if (failedChecks > 0) {
      summary += `${failedChecks} critical issues detected.`;
    } else if (warnChecks > 0) {
      summary += `${warnChecks} warnings detected.`;
    } else {
      summary += 'All systems operational.';
    }
    
    return {
      status: overallStatus,
      checks,
      summary
    };
  }
  
  private async checkAdminOrdersManager() {
    try {
      // Test admin orders manager with a safe read operation
      const { supabase } = await import('@/integrations/supabase/client');
      
      const testStart = Date.now();
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'list',
          page: 1,
          pageSize: 1,
          status: 'all'
        }
      });
      
      const responseTime = Date.now() - testStart;
      
      if (error) {
        return {
          name: 'Admin Orders Manager',
          status: 'fail' as const,
          message: `Function error: ${error.message}`,
          lastChecked: new Date()
        };
      }
      
      if (responseTime > 5000) {
        return {
          name: 'Admin Orders Manager',
          status: 'warn' as const,
          message: `Slow response time: ${responseTime}ms`,
          lastChecked: new Date()
        };
      }
      
      return {
        name: 'Admin Orders Manager',
        status: 'pass' as const,
        message: `Function healthy (${responseTime}ms)`,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        name: 'Admin Orders Manager',
        status: 'fail' as const,
        message: `Exception: ${error.message}`,
        lastChecked: new Date()
      };
    }
  }
  
  private async checkScheduleRecovery() {
    try {
      // Check for any delivery schedule recovery loops or issues
      const recoveryAttempts = this.checkResults.get('recovery_attempts') || 0;
      
      if (recoveryAttempts > 10) {
        return {
          name: 'Schedule Recovery',
          status: 'fail' as const,
          message: `Excessive recovery attempts detected: ${recoveryAttempts}`,
          lastChecked: new Date()
        };
      }
      
      if (recoveryAttempts > 5) {
        return {
          name: 'Schedule Recovery',
          status: 'warn' as const,
          message: `Multiple recovery attempts: ${recoveryAttempts}`,
          lastChecked: new Date()
        };
      }
      
      return {
        name: 'Schedule Recovery',
        status: 'pass' as const,
        message: 'Recovery system stable',
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        name: 'Schedule Recovery',
        status: 'fail' as const,
        message: `Check failed: ${error.message}`,
        lastChecked: new Date()
      };
    }
  }
  
  private async checkDatabaseHealth() {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const testStart = Date.now();
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .limit(1);
      
      const responseTime = Date.now() - testStart;
      
      if (error) {
        return {
          name: 'Database Connection',
          status: 'fail' as const,
          message: `Database error: ${error.message}`,
          lastChecked: new Date()
        };
      }
      
      if (responseTime > 3000) {
        return {
          name: 'Database Connection',
          status: 'warn' as const,
          message: `Slow database response: ${responseTime}ms`,
          lastChecked: new Date()
        };
      }
      
      return {
        name: 'Database Connection',
        status: 'pass' as const,
        message: `Database healthy (${responseTime}ms)`,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        name: 'Database Connection',
        status: 'fail' as const,
        message: `Connection failed: ${error.message}`,
        lastChecked: new Date()
      };
    }
  }
  
  recordRecoveryAttempt() {
    const current = this.checkResults.get('recovery_attempts') || 0;
    this.checkResults.set('recovery_attempts', current + 1);
  }
  
  resetRecoveryCounter() {
    this.checkResults.set('recovery_attempts', 0);
  }
}

export const healthChecker = ProductionHealthChecker.getInstance();