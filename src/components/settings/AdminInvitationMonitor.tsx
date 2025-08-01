import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Mail, 
  RefreshCw, 
  TrendingUp,
  Users,
  ShieldCheck 
} from "lucide-react";

interface InvitationMetrics {
  total_invitations: number;
  pending_invitations: number;
  accepted_invitations: number;
  expired_invitations: number;
  success_rate: number;
}

interface RecentActivity {
  id: string;
  action: string;
  message: string;
  created_at: string;
  new_values?: any;
}

export const AdminInvitationMonitor = () => {
  const [metrics, setMetrics] = useState<InvitationMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      // Calculate metrics manually since the function isn't available in types yet
      const { data, error } = await supabase
        .from('admin_invitations')
        .select('status, expires_at, accepted_at, created_at');

      if (error) throw error;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const recentInvitations = data?.filter(inv => 
        new Date(inv.created_at) >= thirtyDaysAgo
      ) || [];

      const metrics: InvitationMetrics = {
        total_invitations: recentInvitations.length,
        pending_invitations: recentInvitations.filter(inv => 
          inv.status === 'pending' && 
          new Date(inv.expires_at) > now
        ).length,
        accepted_invitations: recentInvitations.filter(inv => 
          inv.accepted_at !== null
        ).length,
        expired_invitations: recentInvitations.filter(inv => 
          inv.status === 'pending' && 
          new Date(inv.expires_at) <= now
        ).length,
        success_rate: recentInvitations.length > 0 
          ? (recentInvitations.filter(inv => inv.accepted_at !== null).length / recentInvitations.length) * 100 
          : 0
      };

      setMetrics(metrics);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load invitation metrics",
        variant: "destructive",
      });
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, message, event_time, new_values')
        .ilike('action', '%admin_invitation%')
        .order('event_time', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentActivity(data?.map(item => ({
        ...item,
        created_at: item.event_time
      })) || []);
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const handleCleanupExpired = async () => {
    setIsCleaningUp(true);
    try {
      // First count expired invitations
      const { count: expiredCount } = await supabase
        .from('admin_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString());

      // Delete expired invitations
      const { error } = await supabase
        .from('admin_invitations')
        .delete()
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;
      
      toast({
        title: "Cleanup Complete",
        description: `Removed ${expiredCount || 0} expired invitations`,
      });

      // Refresh data
      await Promise.all([fetchMetrics(), fetchRecentActivity()]);
    } catch (error) {
      console.error('Error cleaning up:', error);
      toast({
        title: "Error",
        description: "Failed to cleanup expired invitations",
        variant: "destructive",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    await Promise.all([fetchMetrics(), fetchRecentActivity()]);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getActivityIcon = (action: string) => {
    if (action.includes('email_queued')) return <Mail className="h-4 w-4 text-blue-500" />;
    if (action.includes('token_generated')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (action.includes('error') || action.includes('failed')) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (action.includes('cleanup')) return <RefreshCw className="h-4 w-4 text-gray-500" />;
    return <Clock className="h-4 w-4 text-gray-500" />;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Invitation Monitor...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Invitation System Monitor</h3>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of admin invitation system
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanupExpired}
            disabled={isCleaningUp}
          >
            {isCleaningUp ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Cleanup Expired
          </Button>
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invitations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_invitations || 0}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.pending_invitations || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting acceptance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.accepted_invitations || 0}</div>
            <p className="text-xs text-muted-foreground">Successfully registered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.expired_invitations || 0}</div>
            <p className="text-xs text-muted-foreground">Need cleanup</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getSuccessRateColor(metrics?.success_rate || 0)}`}>
              {metrics?.success_rate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">Acceptance rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Real-time logs of invitation system events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No recent activity found. This could indicate an issue with the logging system.
                </AlertDescription>
              </Alert>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 border-b pb-3">
                  {getActivityIcon(activity.action)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {activity.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(activity.created_at)}
                      </span>
                    </div>
                    {activity.new_values && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">
                          Show details
                        </summary>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(activity.new_values, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Health Alerts */}
      {metrics && (
        <div className="space-y-4">
          {metrics.expired_invitations > 5 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You have {metrics.expired_invitations} expired invitations. Consider running cleanup to maintain system performance.
              </AlertDescription>
            </Alert>
          )}
          
          {metrics.success_rate < 50 && metrics.total_invitations > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Low acceptance rate ({metrics.success_rate.toFixed(1)}%). This might indicate email delivery issues or user experience problems.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};