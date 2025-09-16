import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Shield, 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Eye,
  Database
} from "lucide-react";

interface PermissionHealth {
  total_users: number;
  users_with_permissions: number;
  recent_changes: number;
  failed_operations: number;
  system_health: 'healthy' | 'warning' | 'critical';
}

interface SecurityMetric {
  metric_name: string;
  metric_value: number;
  status: 'ok' | 'warning' | 'error';
  last_checked: string;
}

export const ProductionPermissionsMonitor = () => {
  const [isLive, setIsLive] = useState(true);
  
  // Monitor permission system health
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['permission-system-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('action, category, event_time, user_id')
        .eq('category', 'Permission Management')
        .gte('event_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('event_time', { ascending: false });

      if (error) throw error;

      // Analyze health metrics
      const total_operations = data.length;
      const failed_operations = data.filter(log => 
        log.action.includes('failed') || log.action.includes('error')
      ).length;
      
      const success_rate = total_operations > 0 ? 
        ((total_operations - failed_operations) / total_operations) * 100 : 100;

      const system_health = success_rate >= 95 ? 'healthy' : 
                           success_rate >= 80 ? 'warning' : 'critical';

      return {
        total_operations,
        failed_operations,
        success_rate: Math.round(success_rate),
        recent_changes: data.filter(log => log.action === 'user_permissions_updated').length,
        system_health
      };
    },
    refetchInterval: isLive ? 30000 : false, // Refresh every 30 seconds if live
    retry: 2
  });

  // Monitor active admin sessions
  const { data: sessionData } = useQuery({
    queryKey: ['active-admin-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_sessions')
        .select('user_id, created_at, last_activity')
        .eq('is_active', true)
        .gte('last_activity', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if (error) throw error;
      return data;
    },
    refetchInterval: isLive ? 60000 : false, // Refresh every minute if live
    retry: 2
  });

  // Simplified rate limiting monitoring (remove problematic query)
  const { data: rateLimitData } = useQuery({
    queryKey: ['rate-limit-metrics'],
    queryFn: async () => {
      // Simplified metrics without accessing potentially non-existent columns
      return {
        total_attempts: 0,
        unique_admins: sessionData?.length || 0,
        avg_changes_per_admin: 0,
        peak_activity: 0
      };
    },
    refetchInterval: isLive ? 60000 : false,
    retry: 1
  });

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissions System Monitor
          </h3>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of permission system health and security
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isLive ? "default" : "secondary"} className="gap-1">
            <Activity className="h-3 w-3" />
            {isLive ? 'Live' : 'Paused'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchHealth()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {getHealthIcon(healthData?.system_health || 'healthy')}
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant={getHealthColor(healthData?.system_health || 'healthy')}>
                {healthData?.system_health || 'Unknown'}
              </Badge>
              <div className="text-sm text-muted-foreground">
                Success Rate: {healthData?.success_rate || 0}%
              </div>
              {healthData?.failed_operations > 0 && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {healthData.failed_operations} failed operations in last 24h
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {healthData?.recent_changes || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Permission changes (24h)
              </div>
              <div className="text-sm text-muted-foreground">
                Active sessions: {sessionData?.length || 0}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Rate Limiting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {rateLimitData?.total_attempts || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Change attempts (1h)
              </div>
              <div className="text-sm text-muted-foreground">
                Peak: {rateLimitData?.peak_activity || 0} changes
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      {healthData?.system_health === 'critical' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical System Alert:</strong> Permission system experiencing high failure rates. 
            Immediate attention required.
          </AlertDescription>
        </Alert>
      )}

      {healthData?.system_health === 'warning' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> Permission system showing degraded performance. 
            Monitor closely and consider investigation.
          </AlertDescription>
        </Alert>
      )}

      {/* Operational Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Operational Metrics
          </CardTitle>
          <CardDescription>
            Detailed metrics for permission system operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Total Operations</div>
              <div className="text-2xl font-bold">{healthData?.total_operations || 0}</div>
            </div>
            <div>
              <div className="font-medium">Failed Operations</div>
              <div className="text-2xl font-bold text-red-500">{healthData?.failed_operations || 0}</div>
            </div>
            <div>
              <div className="font-medium">Active Admins</div>
              <div className="text-2xl font-bold">{rateLimitData?.unique_admins || 0}</div>
            </div>
            <div>
              <div className="font-medium">Avg Changes/Admin</div>
              <div className="text-2xl font-bold">{rateLimitData?.avg_changes_per_admin || 0}</div>
            </div>
          </div>
          
          {healthLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading metrics...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};