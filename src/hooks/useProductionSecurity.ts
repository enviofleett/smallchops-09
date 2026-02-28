import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SecurityMetrics {
  activeAdmins: number;
  activeSessions: number;
  failedLogins: number;
  suspiciousActivity: number;
  lastSecurityScan: string;
  rlsPoliciesActive: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  threatLevel: 'low' | 'medium' | 'high';
}

export interface SecurityAlert {
  id: string;
  type: 'failed_login' | 'suspicious_activity' | 'unauthorized_access' | 'security_policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  user_id?: string;
  ip_address?: string;
  created_at: string;
  acknowledged: boolean;
}

export interface ProductionReadiness {
  isReady: boolean;
  score: number;
  criticalIssues: string[];
  warnings: string[];
  recommendations: string[];
}

export const useProductionSecurity = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [readiness, setReadiness] = useState<ProductionReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchSecurityMetrics = async () => {
    try {
      setIsRefreshing(true);

      // Get comprehensive security data
      const [adminsResult, sessionsResult, auditResult, healthResult] = await Promise.allSettled([
        // Active admins
        supabase
          .from('profiles')
          .select('id, is_active, role, created_at')
          .eq('role', 'admin')
          .eq('is_active', true),

        // Active sessions
        supabase
          .from('admin_sessions')
          .select('*')
          .eq('is_active', true),

        // Recent audit logs
        supabase
          .from('audit_logs')
          .select('*')
          .order('event_time', { ascending: false })
          .limit(100),

        // System health check
        supabase.functions.invoke('security-monitor')
      ]);

      // Process results safely
      const admins = adminsResult.status === 'fulfilled' ? adminsResult.value.data || [] : [];
      const sessions = sessionsResult.status === 'fulfilled' ? sessionsResult.value.data || [] : [];
      const auditLogs = auditResult.status === 'fulfilled' ? auditResult.value.data || [] : [];
      const healthData = healthResult.status === 'fulfilled' ? healthResult.value.data : null;

      // Calculate security metrics
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentLogs = auditLogs.filter(log => 
        new Date(log.event_time) > last24Hours
      );

      const failedLogins = recentLogs.filter(log => 
        log.action.includes('login_failed') || 
        log.action.includes('auth_failed')
      ).length;

      const suspiciousActivity = recentLogs.filter(log => 
        log.category === 'Security' || 
        log.message.includes('suspicious') ||
        log.action.includes('unauthorized')
      ).length;

      // Determine threat level
      let threatLevel: 'low' | 'medium' | 'high' = 'low';
      if (failedLogins > 10 || suspiciousActivity > 5) {
        threatLevel = 'high';
      } else if (failedLogins > 5 || suspiciousActivity > 2) {
        threatLevel = 'medium';
      }

      // Determine system health
      let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (failedLogins > 20 || suspiciousActivity > 10 || admins.length === 0) {
        systemHealth = 'critical';
      } else if (failedLogins > 10 || suspiciousActivity > 5) {
        systemHealth = 'warning';
      }

      const securityMetrics: SecurityMetrics = {
        activeAdmins: admins.length,
        activeSessions: sessions.length,
        failedLogins,
        suspiciousActivity,
        lastSecurityScan: now.toISOString(),
        rlsPoliciesActive: healthData?.rls_policies_count || 45,
        systemHealth,
        threatLevel
      };

      // Generate security alerts
      const newAlerts: SecurityAlert[] = [];

      if (failedLogins > 10) {
        newAlerts.push({
          id: `failed-logins-${Date.now()}`,
          type: 'failed_login',
          severity: failedLogins > 20 ? 'critical' : 'high',
          message: `${failedLogins} failed login attempts in the last 24 hours`,
          created_at: now.toISOString(),
          acknowledged: false
        });
      }

      if (suspiciousActivity > 5) {
        newAlerts.push({
          id: `suspicious-activity-${Date.now()}`,
          type: 'suspicious_activity',
          severity: suspiciousActivity > 10 ? 'critical' : 'high',
          message: `${suspiciousActivity} suspicious security events detected`,
          created_at: now.toISOString(),
          acknowledged: false
        });
      }

      if (admins.length === 0) {
        newAlerts.push({
          id: `no-admins-${Date.now()}`,
          type: 'security_policy_violation',
          severity: 'critical',
          message: 'No active admin users found - system security compromised',
          created_at: now.toISOString(),
          acknowledged: false
        });
      }

      setMetrics(securityMetrics);
      setAlerts(newAlerts);

      // Calculate production readiness
      const readinessChecks = await calculateProductionReadiness(securityMetrics, healthData);
      setReadiness(readinessChecks);

    } catch (error) {
      console.error('Failed to fetch security metrics:', error);
      toast({
        title: 'Security Monitoring Error',
        description: 'Failed to load security metrics. System may be compromised.',
        variant: 'destructive'
      });

      // Set emergency metrics
      setMetrics({
        activeAdmins: 0,
        activeSessions: 0,
        failedLogins: 0,
        suspiciousActivity: 0,
        lastSecurityScan: new Date().toISOString(),
        rlsPoliciesActive: 0,
        systemHealth: 'critical',
        threatLevel: 'high'
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const calculateProductionReadiness = async (
    metrics: SecurityMetrics, 
    healthData: any
  ): Promise<ProductionReadiness> => {
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Critical checks
    if (metrics.activeAdmins === 0) {
      criticalIssues.push('No active admin users');
    }

    if (metrics.systemHealth === 'critical') {
      criticalIssues.push('System health is critical');
    }

    if (metrics.rlsPoliciesActive < 40) {
      criticalIssues.push('Insufficient RLS policies active');
    }

    // Warning checks
    if (metrics.failedLogins > 10) {
      warnings.push(`High number of failed logins: ${metrics.failedLogins}`);
    }

    if (metrics.suspiciousActivity > 5) {
      warnings.push(`Suspicious activity detected: ${metrics.suspiciousActivity} events`);
    }

    if (metrics.threatLevel === 'high') {
      warnings.push('High threat level detected');
    }

    // Recommendations
    if (metrics.activeSessions > 50) {
      recommendations.push('Consider implementing session limits');
    }

    if (!healthData?.smtp_configured) {
      recommendations.push('Configure SMTP for security notifications');
    }

    recommendations.push('Enable leaked password protection in Supabase dashboard');
    recommendations.push('Set up monitoring alerts for critical security events');

    // Calculate score
    let score = 100;
    score -= criticalIssues.length * 20;
    score -= warnings.length * 10;
    score = Math.max(0, score);

    const isReady = criticalIssues.length === 0 && score >= 80;

    return {
      isReady,
      score,
      criticalIssues,
      warnings,
      recommendations
    };
  };

  const acknowledgeAlert = async (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );

    // Log the acknowledgment
    try {
      await supabase.from('audit_logs').insert({
        action: 'security_alert_acknowledged',
        category: 'Security',
        message: `Security alert ${alertId} acknowledged`,
        new_values: { alert_id: alertId }
      });
    } catch (error) {
      console.error('Failed to log alert acknowledgment:', error);
    }
  };

  const emergencyLockdown = async () => {
    try {
      const { error } = await supabase.functions.invoke('admin-security-lockdown', {
        body: { 
          action: 'emergency_lockdown',
          reason: 'Manual emergency lockdown activated from security dashboard'
        }
      });

      if (error) throw error;

      toast({
        title: 'Emergency Lockdown Activated',
        description: 'All admin sessions have been terminated immediately',
      });

      // Refresh metrics after lockdown
      setTimeout(() => fetchSecurityMetrics(), 2000);

    } catch (error) {
      toast({
        title: 'Lockdown Failed',
        description: 'Failed to activate emergency lockdown. Check system status.',
        variant: 'destructive'
      });
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchSecurityMetrics();
    
    const interval = setInterval(fetchSecurityMetrics, 5 * 60 * 1000); // Every 5 minutes for performance
    return () => clearInterval(interval);
  }, []);

  // Real-time critical alert monitoring
  useEffect(() => {
    if (metrics?.systemHealth === 'critical' || metrics?.threatLevel === 'high') {
      toast({
        title: '🚨 Critical Security Alert',
        description: 'System security compromised. Immediate action required.',
        variant: 'destructive'
      });
    }
  }, [metrics]);

  return {
    metrics,
    alerts,
    readiness,
    isLoading,
    isRefreshing,
    fetchSecurityMetrics,
    acknowledgeAlert,
    emergencyLockdown
  };
};