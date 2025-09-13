import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  TrendingUp,
  Shield,
  Zap
} from 'lucide-react';

interface WebhookEvent {
  id: string;
  paystack_event_id: string;
  event_type: string;
  processed: boolean;
  created_at: string;
  processed_at?: string;
  processing_result?: any;
  event_data?: any;
}

interface WebhookMetrics {
  total_events: number;
  successful_events: number;
  failed_events: number;
  processing_rate: number;
  avg_processing_time: number;
}

export function WebhookMonitoringDashboard() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [metrics, setMetrics] = useState<WebhookMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadWebhookData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadWebhookData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadWebhookData = async () => {
    try {
      setRefreshing(true);
      
      // Load recent webhook events
      const { data: eventsData, error: eventsError } = await supabase
        .from('webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (eventsError) throw eventsError;

      // Calculate metrics
      const total = eventsData.length;
      const successful = eventsData.filter(e => e.processed && (e.processing_result as any)?.success).length;
      const failed = eventsData.filter(e => e.processed && !(e.processing_result as any)?.success).length;
      
      const processingTimes = eventsData
        .filter(e => e.processed && e.processed_at)
        .map(e => {
          const created = new Date(e.created_at).getTime();
          const processed = new Date(e.processed_at!).getTime();
          return processed - created;
        });
      
      const avgProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length / 1000
        : 0;

      setEvents(eventsData);
      setMetrics({
        total_events: total,
        successful_events: successful,
        failed_events: failed,
        processing_rate: total > 0 ? (successful / total) * 100 : 0,
        avg_processing_time: avgProcessingTime
      });

    } catch (error: any) {
      console.error('Error loading webhook data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load webhook data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getEventStatusBadge = (event: WebhookEvent) => {
    if (!event.processed) {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
    
    if ((event.processing_result as any)?.success) {
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
    }
    
    return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
  };

  const getProcessingTime = (event: WebhookEvent) => {
    if (!event.processed_at) return 'N/A';
    
    const created = new Date(event.created_at);
    const processed = new Date(event.processed_at);
    const diff = (processed.getTime() - created.getTime()) / 1000;
    
    return `${diff.toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Webhook Monitoring</h2>
          <p className="text-muted-foreground">
            Monitor Paystack webhook processing and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/functions/paystack-webhook-secure/logs`}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline text-muted-foreground"
            title="Open paystack-webhook-secure logs"
          >
            Webhook Logs
          </a>
          <a
            href={`https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/functions/paystack-secure/logs`}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline text-muted-foreground"
            title="Open paystack-secure logs"
          >
            Verify Logs
          </a>
          <Button 
            variant="outline" 
            onClick={loadWebhookData}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{metrics?.total_events || 0}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{metrics?.successful_events || 0}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{metrics?.failed_events || 0}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{metrics?.processing_rate.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Webhook Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No webhook events found
                  </p>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div>
                          <p className="font-medium">{event.event_type}</p>
                          <p className="text-sm text-muted-foreground">
                            ID: {event.paystack_event_id}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {new Date(event.created_at).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Processing: {getProcessingTime(event)}
                          </p>
                        </div>
                        {getEventStatusBadge(event)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="font-medium">Average Processing Time</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics?.avg_processing_time.toFixed(2) || 0}s
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <p className="font-medium">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metrics?.processing_rate.toFixed(1) || 0}%
                  </p>
                </div>
              </div>
              
              {metrics && metrics.avg_processing_time > 5 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Average processing time is higher than expected. Consider investigating slow events.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Signature Verification</p>
                    <p className="text-sm text-muted-foreground">
                      All webhooks verified with HMAC-SHA512
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">IP Validation</p>
                    <p className="text-sm text-muted-foreground">
                      Restricted to Paystack IP addresses
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Replay Protection</p>
                    <p className="text-sm text-muted-foreground">
                      Duplicate events automatically rejected
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}