import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentHealthData {
  health_status: 'healthy' | 'warning' | 'critical';
  health_score: number;
  data: {
    orders: {
      total: number;
      paid: number;
      pending: number;
      completion_rate: number;
    };
    transactions: {
      total: number;
      successful: number;
    };
    alerts: Array<{
      severity: 'warning' | 'critical';
      message: string;
    }>;
    recommendations: string[];
  };
}

export const PaymentRecoveryPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [healthData, setHealthData] = useState<PaymentHealthData | null>(null);
  const [emergencyForm, setEmergencyForm] = useState({
    order_number: '',
    paystack_reference: ''
  });

  const checkPaymentHealth = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-recovery', {
        body: { action: 'health_check' }
      });

      if (error) throw error;

      if (data.success) {
        setHealthData(data);
      } else {
        toast.error('Health check failed: ' + data.error);
      }
    } catch (error: any) {
      toast.error('Failed to check payment health: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runEmergencyFix = async () => {
    if (!emergencyForm.order_number || !emergencyForm.paystack_reference) {
      toast.error('Both order number and Paystack reference are required');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-recovery', {
        body: {
          action: 'emergency_fix',
          order_number: emergencyForm.order_number,
          paystack_reference: emergencyForm.paystack_reference
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Emergency fix completed successfully!');
        setEmergencyForm({ order_number: '', paystack_reference: '' });
        // Refresh health data
        await checkPaymentHealth();
      } else {
        toast.error('Emergency fix failed: ' + data.error);
      }
    } catch (error: any) {
      toast.error('Emergency fix failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const syncPayments = async (hours: number = 24) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-recovery', {
        body: { action: 'sync_payments', hours }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Payment sync completed: ${data.data.synced_count} payments recovered`);
        // Refresh health data
        await checkPaymentHealth();
      } else {
        toast.error('Payment sync failed: ' + data.error);
      }
    } catch (error: any) {
      toast.error('Payment sync failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  React.useEffect(() => {
    checkPaymentHealth();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payment Recovery Center</h2>
          <p className="text-muted-foreground">Monitor and fix payment issues</p>
        </div>
        <Button
          onClick={checkPaymentHealth}
          disabled={isLoading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Health Overview */}
      {healthData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getHealthIcon(healthData.health_status)}
              Payment System Health
              <Badge 
                variant="secondary" 
                className={`${getHealthBadgeColor(healthData.health_status)} text-white`}
              >
                {healthData.health_status.toUpperCase()}
              </Badge>
            </CardTitle>
            <CardDescription>
              Health Score: {healthData.health_score.toFixed(1)}% | Last 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{healthData.data.orders.total}</div>
                <div className="text-sm text-muted-foreground">Total Orders</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">{healthData.data.orders.paid}</div>
                <div className="text-sm text-muted-foreground">Paid Orders</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{healthData.data.orders.pending}</div>
                <div className="text-sm text-muted-foreground">Pending Orders</div>
              </div>
            </div>

            {healthData.data.alerts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Alerts</h4>
                {healthData.data.alerts.map((alert, index) => (
                  <Alert key={index} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{alert.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emergency Fix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Emergency Payment Fix
            </CardTitle>
            <CardDescription>
              Manually fix a specific stuck payment (for ORD-20250811-8222)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="order_number">Order Number</Label>
              <Input
                id="order_number"
                placeholder="ORD-20250811-8222"
                value={emergencyForm.order_number}
                onChange={(e) => setEmergencyForm(prev => ({ ...prev, order_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paystack_reference">Paystack Reference</Label>
              <Input
                id="paystack_reference"
                placeholder="txn_1754906935502_dda21f55-7931-4bd3-b012-180c53e398d2"
                value={emergencyForm.paystack_reference}
                onChange={(e) => setEmergencyForm(prev => ({ ...prev, paystack_reference: e.target.value }))}
              />
            </div>
            <Button
              onClick={runEmergencyFix}
              disabled={isLoading}
              className="w-full"
              variant="destructive"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              Run Emergency Fix
            </Button>
          </CardContent>
        </Card>

        {/* Payment Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              Payment Sync
            </CardTitle>
            <CardDescription>
              Sync verified Paystack payments with database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will check all pending orders against Paystack and update successful payments.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => syncPayments(24)}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <Clock className="h-4 w-4 mr-2" />
                Last 24h
              </Button>
              <Button
                onClick={() => syncPayments(48)}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <Clock className="h-4 w-4 mr-2" />
                Last 48h
              </Button>
            </div>
            <Button
              onClick={() => syncPayments(72)}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync Last 72 Hours
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {healthData?.data.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {healthData.data.recommendations.map((rec, index) => (
                <li key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};