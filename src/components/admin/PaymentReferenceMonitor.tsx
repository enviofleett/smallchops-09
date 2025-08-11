import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Zap, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { checkOrderReferenceMigration } from '@/utils/paymentReference';
import { toast } from 'sonner';

interface ReferenceStats {
  totalOrders: number;
  txnFormatOrders: number;
  checkoutFormatOrders: number;
  otherFormatOrders: number;
  recentPaymentCompletionRate: number;
}

export const PaymentReferenceMonitor: React.FC = () => {
  const [stats, setStats] = useState<ReferenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check migration status
      const migrationResult = await checkOrderReferenceMigration(supabase);
      
      // Get comprehensive stats
      const { data: orderStats, error: statsError } = await supabase
        .from('orders')
        .select('payment_reference, payment_status, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (statsError) throw statsError;

      const totalOrders = orderStats?.length || 0;
      const txnFormatOrders = orderStats?.filter(o => o.payment_reference?.startsWith('txn_')).length || 0;
      const checkoutFormatOrders = orderStats?.filter(o => o.payment_reference?.startsWith('checkout_')).length || 0;
      const otherFormatOrders = totalOrders - txnFormatOrders - checkoutFormatOrders;
      
      // Calculate recent completion rate
      const paidOrders = orderStats?.filter(o => o.payment_status === 'paid').length || 0;
      const recentPaymentCompletionRate = totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0;

      setStats({
        totalOrders,
        txnFormatOrders,
        checkoutFormatOrders,
        otherFormatOrders,
        recentPaymentCompletionRate
      });

      if (!migrationResult.success) {
        setError(migrationResult.error || 'Failed to check migration status');
      }

    } catch (err) {
      console.error('Error fetching payment reference stats:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 85) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCompletionRateStatus = (rate: number) => {
    if (rate >= 85) return 'Excellent';
    if (rate >= 70) return 'Good';
    return 'Needs Attention';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Payment Reference Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Payment Reference Monitor - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={fetchStats} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const txnPercentage = stats.totalOrders > 0 ? (stats.txnFormatOrders / stats.totalOrders) * 100 : 0;
  const isFullyMigrated = stats.checkoutFormatOrders === 0 && stats.txnFormatOrders > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Payment Reference Migration Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFullyMigrated ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-green-700">
              Migration complete! All new orders are using the txn_ reference format.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-orange-700">
              Migration in progress. {stats.checkoutFormatOrders} orders still using old checkout_ format.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <div className="text-sm text-muted-foreground">Total Orders (7d)</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.txnFormatOrders}</div>
            <div className="text-sm text-muted-foreground">txn_ Format</div>
            <Badge variant="outline" className="mt-1">{txnPercentage.toFixed(1)}%</Badge>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.checkoutFormatOrders}</div>
            <div className="text-sm text-muted-foreground">checkout_ Format</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.otherFormatOrders}</div>
            <div className="text-sm text-muted-foreground">Other Formats</div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Payment Completion Rate (7d)</span>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${getCompletionRateColor(stats.recentPaymentCompletionRate)}`}>
                {stats.recentPaymentCompletionRate.toFixed(1)}%
              </span>
              <Badge 
                variant={stats.recentPaymentCompletionRate >= 85 ? "default" : 
                       stats.recentPaymentCompletionRate >= 70 ? "secondary" : "destructive"}
              >
                {getCompletionRateStatus(stats.recentPaymentCompletionRate)}
              </Badge>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-muted-foreground">
            Expected improvement to 90%+ after full migration to txn_ format
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={fetchStats} variant="outline" size="sm">
            <Zap className="h-4 w-4 mr-2" />
            Refresh Stats
          </Button>
          
          {stats.recentPaymentCompletionRate < 85 && (
            <Button 
              onClick={() => {
                toast.info('Migration in progress', {
                  description: 'The new txn_ reference format should improve payment completion rates significantly.'
                });
              }}
              variant="secondary" 
              size="sm"
            >
              Migration Info
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};