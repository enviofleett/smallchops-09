import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw,
  Users,
  Database,
  Clock
} from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: string;
}

export const PermissionMatrixHealthMonitor = () => {
  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ['permission-system-health'],
    queryFn: async (): Promise<HealthCheck[]> => {
      const checks: HealthCheck[] = [];
      
      try {
        // Check admin users
        const { data: adminUsers, error: adminError } = await supabase.rpc('get_admin_users_secure');
        if (adminError) {
          checks.push({
            name: 'Admin User Access',
            status: 'error',
            message: 'Cannot fetch admin users',
            details: adminError.message
          });
        } else if (!adminUsers || adminUsers.length === 0) {
          checks.push({
            name: 'Admin User Access',
            status: 'warning',
            message: 'No admin users found',
            details: 'At least one admin user should exist'
          });
        } else {
          checks.push({
            name: 'Admin User Access',
            status: 'healthy',
            message: `${adminUsers.length} admin users active`,
            details: `Active admins: ${adminUsers.filter(u => u.is_active).length}`
          });
        }

        // Check menu structure
        const { data: menuData, error: menuError } = await supabase.rpc('get_menu_structure_secure');
        if (menuError) {
          checks.push({
            name: 'Menu Structure',
            status: 'error', 
            message: 'Cannot load menu structure',
            details: menuError.message
          });
        } else if (!menuData || menuData.length === 0) {
          checks.push({
            name: 'Menu Structure',
            status: 'error',
            message: 'No menu structure found',
            details: 'Menu structure is required for permissions'
          });
        } else {
          const settingsMenus = menuData.filter(m => m.key.startsWith('settings'));
          checks.push({
            name: 'Menu Structure',
            status: 'healthy',
            message: `${menuData.length} menu items configured`,
            details: `Settings menus: ${settingsMenus.length}`
          });
        }

        // Check permission functions availability
        try {
          await supabase.rpc('update_user_permissions_secure', {
            target_user_id: '00000000-0000-0000-0000-000000000000', // Test with dummy ID
            permissions_data: {}
          });
        } catch (error: any) {
          if (error.message?.includes('function') && error.message?.includes('does not exist')) {
            checks.push({
              name: 'Permission Functions',
              status: 'error',
              message: 'Permission update functions missing',
              details: 'Database functions need to be deployed'
            });
          } else {
            // Function exists but failed (expected for dummy ID)
            checks.push({
              name: 'Permission Functions',
              status: 'healthy',
              message: 'Permission functions available'
            });
          }
        }

        // Check database connection
        const { error: dbError } = await supabase.from('profiles').select('count').limit(1);
        if (dbError) {
          checks.push({
            name: 'Database Connection',
            status: 'error',
            message: 'Database connection failed',
            details: dbError.message
          });
        } else {
          checks.push({
            name: 'Database Connection',
            status: 'healthy',
            message: 'Database connection active'
          });
        }

      } catch (error: any) {
        checks.push({
          name: 'System Health Check',
          status: 'error',
          message: 'Health check failed',
          details: error.message
        });
      }

      return checks;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning': return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Warning</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const overallStatus = healthData?.every(h => h.status === 'healthy') ? 'healthy' :
                       healthData?.some(h => h.status === 'error') ? 'error' : 'warning';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permission System Health
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="ml-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Real-time monitoring of permission system components and security status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            {getStatusIcon(overallStatus)}
            <span className="font-medium">Overall System Status</span>
          </div>
          {getStatusBadge(overallStatus)}
        </div>

        {/* Individual Health Checks */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 animate-pulse">
                <div className="h-4 bg-muted rounded w-32"></div>
                <div className="h-6 bg-muted rounded w-16"></div>
              </div>
            ))
          ) : (
            healthData?.map((check, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(check.status)}
                    <span className="font-medium text-sm">{check.name}</span>
                  </div>
                  {getStatusBadge(check.status)}
                </div>
                
                <div className="ml-6 text-sm text-muted-foreground">
                  <div>{check.message}</div>
                  {check.details && (
                    <div className="text-xs mt-1 opacity-75">{check.details}</div>
                  )}
                </div>

                {check.status === 'error' && (
                  <Alert variant="destructive" className="ml-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {check.details || check.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))
          )}
        </div>

        {/* Production Readiness Score */}
        {healthData && (
          <div className="mt-6 p-4 rounded-lg border bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Production Readiness Score</span>
              <Badge variant={overallStatus === 'healthy' ? 'default' : 'destructive'}>
                {Math.round((healthData.filter(h => h.status === 'healthy').length / healthData.length) * 100)}%
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {healthData.filter(h => h.status === 'healthy').length} of {healthData.length} systems healthy
            </div>
          </div>
        )}

        {/* Action Items */}
        {healthData?.some(h => h.status !== 'healthy') && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Action Required:</strong> {healthData.filter(h => h.status === 'error').length} critical issues and{' '}
              {healthData.filter(h => h.status === 'warning').length} warnings need attention before production deployment.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};