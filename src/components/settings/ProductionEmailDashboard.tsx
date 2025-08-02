import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  Mail, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Shield,
  BarChart3,
  Settings,
  RefreshCw
} from 'lucide-react';

interface EmailMetrics {
  total_queued: number;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_bounced: number;
  delivery_rate: number;
  bounce_rate: number;
  average_processing_time: number;
  peak_queue_size: number;
  error_categories: Record<string, number>;
}

interface DeliveryConfirmation {
  id: string;
  communication_event_id: string;
  recipient_email?: string;
  delivery_status: string;
  delivery_timestamp?: string;
  delivered_at?: string;
  error_message?: string;
  created_at: string;
  provider_response?: any;
}

export const ProductionEmailDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [confirmations, setConfirmations] = useState<DeliveryConfirmation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchEmailMetrics = async () => {
    try {
      const { data, error } = await supabase.rpc('calculate_daily_email_metrics');
      
      if (error) throw error;
      
      // Type assertion for the RPC result
      setMetrics(data as unknown as EmailMetrics);
    } catch (error: any) {
      console.error('Error fetching email metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch email metrics',
        variant: 'destructive',
      });
    }
  };

  const fetchDeliveryConfirmations = async () => {
    try {
      const { data, error } = await supabase
        .from('email_delivery_confirmations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      setConfirmations(data || []);
    } catch (error: any) {
      console.error('Error fetching delivery confirmations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch delivery confirmations',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchEmailMetrics(), fetchDeliveryConfirmations()]);
    setIsRefreshing(false);
    
    toast({
      title: 'Refreshed',
      description: 'Email dashboard data has been updated',
    });
  };

  const triggerEnhancedProcessing = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-communication-events-enhanced', {
        body: { immediate_processing: true }
      });

      if (error) throw error;

      toast({
        title: 'Processing Started',
        description: `Processing ${data.total || 0} queued emails`,
      });
      
      // Refresh data after processing
      setTimeout(handleRefresh, 2000);
    } catch (error: any) {
      console.error('Error triggering email processing:', error);
      toast({
        title: 'Processing Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchEmailMetrics(), fetchDeliveryConfirmations()]);
      setIsLoading(false);
    };

    loadData();

    // Set up real-time updates
    const interval = setInterval(handleRefresh, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getHealthScore = (): { score: number; status: string; color: string } => {
    if (!metrics) return { score: 0, status: 'Unknown', color: 'gray' };
    
    const deliveryRate = metrics.delivery_rate || 0;
    const bounceRate = metrics.bounce_rate || 0;
    
    let score = 100;
    score -= bounceRate * 2; // Penalize bounce rate heavily
    score = Math.max(0, Math.min(100, score));
    
    if (score >= 95) return { score, status: 'Excellent', color: 'green' };
    if (score >= 85) return { score, status: 'Good', color: 'blue' };
    if (score >= 70) return { score, status: 'Fair', color: 'yellow' };
    return { score, status: 'Poor', color: 'red' };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'bounced':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'complained':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'bounced':
        return 'bg-red-100 text-red-800';
      case 'complained':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const healthScore = getHealthScore();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading email dashboard...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Production Email Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of email delivery performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={triggerEnhancedProcessing}
            size="sm"
          >
            <Mail className="h-4 w-4 mr-2" />
            Process Queue
          </Button>
        </div>
      </div>

      {/* Health Overview */}
      <Alert className={`border-${healthScore.color}-200 bg-${healthScore.color}-50`}>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span>
              <strong>Email System Health: {healthScore.status}</strong> 
              ({healthScore.score}/100)
            </span>
            <Badge variant={healthScore.score >= 85 ? "default" : "destructive"}>
              {healthScore.score >= 85 ? "Healthy" : "Needs Attention"}
            </Badge>
          </div>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">📊 Metrics</TabsTrigger>
          <TabsTrigger value="confirmations">✅ Confirmations</TabsTrigger>
          <TabsTrigger value="errors">⚠️ Error Analysis</TabsTrigger>
          <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.total_sent || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +{metrics?.total_queued || 0} queued
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.delivery_rate?.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.total_delivered || 0} delivered
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.bounce_rate?.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.total_bounced || 0} bounced
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Process Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.average_processing_time ? `${metrics.average_processing_time}s` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Peak queue: {metrics?.peak_queue_size || 0}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="confirmations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Delivery Confirmations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {confirmations.length === 0 ? (
                  <p className="text-muted-foreground">No delivery confirmations found</p>
                ) : (
                  confirmations.map((confirmation) => (
                    <div key={confirmation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(confirmation.delivery_status)}
                        <div>
                          <p className="font-medium">{confirmation.recipient_email}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(confirmation.delivery_timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(confirmation.delivery_status)}>
                        {confirmation.delivery_status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics?.error_categories && Object.keys(metrics.error_categories).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(metrics.error_categories).map(([error, count]) => (
                    <div key={error} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="font-medium">{error}</span>
                      </div>
                      <Badge variant="destructive">{count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No errors found today</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Production Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Settings className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Rate Limiting:</strong> Transactional emails: 50/hour, 200/day | Marketing emails: 10/hour, 50/day
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Monitoring:</strong> Real-time delivery confirmation tracking and error categorization enabled
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Security:</strong> Admin notifications configured for critical failures
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};