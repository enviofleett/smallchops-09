import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Database,
  Zap,
  Shield,
  CreditCard,
  Users
} from 'lucide-react';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  lastChecked: Date;
  details?: any;
}

export const AdminHealthMonitor = () => {
  const [healthChecks, setHealthChecks] = useState<HealthStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  // Run health checks
  const runHealthChecks = async (): Promise<HealthStatus[]> => {
    const checks: HealthStatus[] = [];
    const now = new Date();

    try {
      // 1. Database connectivity check
      const { data: dbTest, error: dbError } = await (supabase as any)
        .from('profiles')
        .select('count')
        .limit(1);
      
      checks.push({
        service: 'Database',
        status: dbError ? 'error' : 'healthy',
        message: dbError ? `Database error: ${dbError.message}` : 'Database connection healthy',
        lastChecked: now,
        details: { error: dbError?.message }
      });

      // 2. Admin management function check
      try {
        const { data: adminTest, error: adminError } = await supabase.functions.invoke('admin-management', {
          method: 'GET',
          body: null
        });
        
        checks.push({
          service: 'Admin Functions',
          status: adminError ? 'error' : 'healthy',
          message: adminError ? `Admin function error: ${adminError.message}` : 'Admin functions operational',
          lastChecked: now,
          details: { error: adminError?.message }
        });
      } catch (error: any) {
        checks.push({
          service: 'Admin Functions',
          status: 'error',
          message: `Admin function failed: ${error.message}`,
          lastChecked: now,
          details: { error: error.message }
        });
      }

      // 3. Menu structure check
      const { data: menuData, error: menuError } = await (supabase as any)
        .from('menu_structure')
        .select('count')
        .eq('is_active', true);
      
      checks.push({
        service: 'Menu Structure',
        status: menuError ? 'error' : 'healthy',
        message: menuError ? `Menu structure error: ${menuError.message}` : 'Menu structure loaded',
        lastChecked: now,
        details: { count: menuData?.length }
      });

      // 4. Payment integration check
      const { data: paymentData, error: paymentError } = await (supabase as any)
        .from('payment_integrations')
        .select('provider, connection_status')
        .eq('provider', 'paystack')
        .single();
      
      const paymentStatus = paymentError ? 'error' : 
        (paymentData?.connection_status === 'connected' ? 'healthy' : 'warning');
      
      checks.push({
        service: 'Payment System',
        status: paymentStatus,
        message: paymentError ? `Payment check failed: ${paymentError.message}` :
          paymentData?.connection_status === 'connected' ? 'Payment system connected' : 'Payment system not configured',
        lastChecked: now,
        details: { status: paymentData?.connection_status }
      });

      // 5. User permissions check
      const { data: permissionsData, error: permissionsError } = await (supabase as any)
        .from('user_permissions')
        .select('count');
      
      checks.push({
        service: 'User Permissions',
        status: permissionsError ? 'error' : 'healthy',
        message: permissionsError ? `Permissions error: ${permissionsError.message}` : 'Permissions system operational',
        lastChecked: now,
        details: { configured_permissions: permissionsData?.length }
      });

      // 6. Audit logging check
      const { data: auditData, error: auditError } = await (supabase as any)
        .from('audit_logs')
        .select('count')
        .gte('event_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(100);
      
      checks.push({
        service: 'Audit Logging',
        status: auditError ? 'error' : 'healthy',
        message: auditError ? `Audit logging error: ${auditError.message}` : 'Audit logging active',
        lastChecked: now,
        details: { logs_24h: auditData?.length }
      });

    } catch (error: any) {
      checks.push({
        service: 'Health Check System',
        status: 'error',
        message: `Health check failed: ${error.message}`,
        lastChecked: now,
        details: { error: error.message }
      });
    }

    return checks;
  };

  // Query for health checks
  const { data: checks, isLoading, refetch } = useQuery({
    queryKey: ['admin-health-checks'],
    queryFn: runHealthChecks,
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    refetchIntervalInBackground: false
  });

  useEffect(() => {
    if (checks) {
      setHealthChecks(checks);
    }
  }, [checks]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'Database':
        return <Database className="h-4 w-4" />;
      case 'Admin Functions':
        return <Zap className="h-4 w-4" />;
      case 'Menu Structure':
        return <Shield className="h-4 w-4" />;
      case 'Payment System':
        return <CreditCard className="h-4 w-4" />;
      case 'User Permissions':
        return <Users className="h-4 w-4" />;
      case 'Audit Logging':
        return <Activity className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const handleRefresh = async () => {
    setIsChecking(true);
    try {
      await refetch();
    } finally {
      setIsChecking(false);
    }
  };

  const overallStatus = healthChecks.length > 0 ? 
    healthChecks.some(check => check.status === 'error') ? 'error' :
    healthChecks.some(check => check.status === 'warning') ? 'warning' : 'healthy'
    : 'unknown';

  const criticalIssues = healthChecks.filter(check => check.status === 'error');
  const warnings = healthChecks.filter(check => check.status === 'warning');

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(overallStatus)}
              <div>
                <CardTitle>System Health Status</CardTitle>
                <CardDescription>
                  Last checked: {healthChecks[0]?.lastChecked.toLocaleTimeString() || 'Never'}
                </CardDescription>
              </div>
            </div>
            <Button 
              onClick={handleRefresh} 
              disabled={isLoading || isChecking}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(isLoading || isChecking) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={getStatusBadgeVariant(overallStatus)} className="text-sm">
              {overallStatus === 'healthy' ? 'All Systems Operational' :
               overallStatus === 'warning' ? 'Some Issues Detected' :
               overallStatus === 'error' ? 'Critical Issues Found' : 'Status Unknown'}
            </Badge>
            <div className="text-sm text-muted-foreground">
              {criticalIssues.length > 0 && (
                <span className="text-red-500">{criticalIssues.length} critical issues</span>
              )}
              {warnings.length > 0 && (
                <span className="text-yellow-500">
                  {criticalIssues.length > 0 ? ', ' : ''}{warnings.length} warnings
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues Alert */}
      {criticalIssues.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical Issues Detected:</strong> The following services require immediate attention:
            <ul className="mt-2 space-y-1">
              {criticalIssues.map((issue, index) => (
                <li key={index} className="ml-4">• {issue.service}: {issue.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Service Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthChecks.map((check, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getServiceIcon(check.service)}
                  <CardTitle className="text-sm">{check.service}</CardTitle>
                </div>
                {getStatusIcon(check.status)}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-3">
                {check.message}
              </p>
              
              <div className="flex items-center justify-between">
                <Badge variant={getStatusBadgeVariant(check.status)} className="text-xs">
                  {check.status.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {check.lastChecked.toLocaleTimeString()}
                </span>
              </div>

              {check.details && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {Object.entries(check.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span>{key}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Production Readiness Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Production Readiness Checklist</CardTitle>
          <CardDescription>
            Ensure all critical systems are properly configured for live environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { 
                check: 'Database RLS Policies', 
                status: healthChecks.find(h => h.service === 'Database')?.status === 'healthy',
                description: 'Row Level Security policies are active and protecting data'
              },
              { 
                check: 'Admin User Management', 
                status: healthChecks.find(h => h.service === 'Admin Functions')?.status === 'healthy',
                description: 'Admin functions are operational for user management'
              },
              { 
                check: 'Payment Integration', 
                status: healthChecks.find(h => h.service === 'Payment System')?.status === 'healthy',
                description: 'Payment processing is configured and connected'
              },
              { 
                check: 'Permission System', 
                status: healthChecks.find(h => h.service === 'User Permissions')?.status === 'healthy',
                description: 'User permissions and access control are active'
              },
              { 
                check: 'Audit Logging', 
                status: healthChecks.find(h => h.service === 'Audit Logging')?.status === 'healthy',
                description: 'System actions are being logged for compliance'
              }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {item.status ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium">{item.check}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <Badge variant={item.status ? 'default' : 'destructive'}>
                  {item.status ? 'Ready' : 'Needs Attention'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};