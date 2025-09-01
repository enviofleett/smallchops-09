
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, 
  Settings, 
  Activity,
  Archive,
  AlertTriangle
} from 'lucide-react';
import { EmailSystemStatus } from './EmailSystemStatus';
import { useSMTPSettings } from '@/hooks/useSMTPSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RecentEmailActivity {
  id: string;
  event_type: string;
  recipient_email: string;
  status: string;
  created_at: string;
  error_message?: string;
}

export const EmailManagement = () => {
  const { settings, isLoading: settingsLoading, testConnection, isTesting } = useSMTPSettings();

  // Get recent email activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-email-activity'],
    queryFn: async (): Promise<RecentEmailActivity[]> => {
      const { data, error } = await supabase
        .from('communication_events')
        .select('id, event_type, recipient_email, status, created_at, error_message')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Get system health stats
  const { data: healthStats } = useQuery({
    queryKey: ['email-health-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('communication_events')
        .select('status')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const statusCounts = data?.reduce((acc, event) => {
        acc[event.status] = (acc[event.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
      const successRate = total > 0 ? Math.round(((statusCounts.sent || 0) / total) * 100) : 0;

      return { statusCounts, total, successRate };
    },
    refetchInterval: 60000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status */}
      <EmailSystemStatus />

      {/* Main Email Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email System Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Recent Activity</TabsTrigger>
              <TabsTrigger value="settings">SMTP Settings</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Success Rate (7 days)</p>
                      <p className="text-2xl font-bold text-blue-700">{healthStats?.successRate || 0}%</p>
                    </div>
                    <Activity className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Total Emails</p>
                      <p className="text-2xl font-bold text-green-700">{healthStats?.total || 0}</p>
                    </div>
                    <Mail className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-600">Failed</p>
                      <p className="text-2xl font-bold text-red-700">{healthStats?.statusCounts.failed || 0}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recent Email Activity</h4>
                {activityLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {recentActivity?.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{activity.event_type}</span>
                            <Badge className={getStatusColor(activity.status)}>
                              {activity.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">{activity.recipient_email}</p>
                          {activity.error_message && (
                            <p className="text-xs text-red-500 mt-1">{activity.error_message}</p>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(activity.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">SMTP Configuration</h4>
                    <p className="text-xs text-gray-500">
                      Status: {settings?.use_smtp ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => testConnection()}
                    disabled={isTesting || settingsLoading}
                  >
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </Button>
                </div>
                
                {settings?.smtp_host && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-medium">Host:</span> {settings.smtp_host}
                      </div>
                      <div>
                        <span className="font-medium">Port:</span> {settings.smtp_port}
                      </div>
                      <div>
                        <span className="font-medium">Sender:</span> {settings.sender_email}
                      </div>
                      <div>
                        <span className="font-medium">Secure:</span> {settings.smtp_secure ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-4">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Archive className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-800">Automated Cleanup</h4>
                      <p className="text-xs text-blue-700 mt-1">
                        Email cleanup runs daily at midnight UTC. Stale items are automatically archived and removed.
                      </p>
                      <div className="text-xs text-blue-600 mt-2">
                        • Processing items older than 2 hours are marked as failed<br/>
                        • Queued items older than 1 day are marked as failed<br/>
                        • Failed logs are archived after 7 days<br/>
                        • Sent logs are kept for 30 days
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Settings className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">Manual Actions</h4>
                      <p className="text-xs text-yellow-700 mt-1">
                        Use the "Clean Up" button in the system status above to manually trigger cleanup if needed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
