import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, XCircle, Clock, Mail, RefreshCw } from 'lucide-react';
import { useEmailMonitoring } from '@/hooks/useEmailMonitoring';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeliveryConfirmation {
  id: string;
  communication_event_id: string;
  delivery_status: string;
  provider_response: any;
  delivered_at: string;
  created_at: string;
}

export const EmailDeliveryMonitor = () => {
  const [confirmations, setConfirmations] = useState<DeliveryConfirmation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { metrics, isLoading: metricsLoading, refreshMetrics } = useEmailMonitoring();
  const { toast } = useToast();

  const fetchDeliveryConfirmations = async () => {
    try {
      const { data, error } = await supabase
        .from('email_delivery_confirmations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setConfirmations(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to fetch delivery confirmations: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveryConfirmations();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'delivered': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'bounced': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'complained': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'bounced': return 'bg-red-100 text-red-800';
      case 'complained': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchDeliveryConfirmations(),
      refreshMetrics()
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold">{metrics.totalSent}</p>
                </div>
                <Mail className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delivered</p>
                  <p className="text-2xl font-bold text-green-600">{metrics.totalDelivered}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Bounce Rate</p>
                  <p className="text-2xl font-bold text-red-600">{metrics.bounceRate}%</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                  <p className="text-2xl font-bold text-blue-600">{metrics.healthScore}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Delivery Confirmations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Recent Email Deliveries
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || metricsLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading delivery confirmations...</div>
          ) : confirmations.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No delivery confirmations found
            </div>
          ) : (
            <div className="space-y-3">
              {confirmations.map((confirmation) => (
                <div
                  key={confirmation.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(confirmation.delivery_status)}
                    <div>
                      <div className="font-medium">
                        Event ID: {confirmation.communication_event_id.slice(0, 8)}...
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(confirmation.delivered_at || confirmation.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusColor(confirmation.delivery_status)}>
                    {confirmation.delivery_status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Issues & Recommendations */}
      {metrics?.issues && metrics.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Health Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.issues.map((issue, index) => (
                <div key={index} className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {metrics?.recommendations && metrics.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <CheckCircle className="h-5 w-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-center gap-2 text-blue-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{recommendation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};