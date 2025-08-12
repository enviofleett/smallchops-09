import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ReconciliationResult {
  order_id: string;
  order_number: string;
  reference: string;
  status: 'success' | 'failed' | 'pending' | 'not_found';
  message: string;
  payment_amount?: number;
  order_amount?: number;
}

interface ReconciliationSummary {
  total_processed: number;
  successful: number;
  failed: number;
  pending: number;
  not_found: number;
}

export const PaymentEmergencyPanel: React.FC = () => {
  const [isReconciling, setIsReconciling] = useState(false);
  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const { toast } = useToast();

  const runEmergencyReconciliation = async () => {
    setIsReconciling(true);
    try {
      toast({
        title: "Emergency Reconciliation",
        description: "Starting emergency payment reconciliation...",
      });

      const { data, error } = await supabase.functions.invoke('emergency-payment-reconciliation', {
        body: {
          action: 'reconcile_pending_orders'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setResults(data.results);
        setSummary(data.summary);
        toast({
          title: "Reconciliation Complete",
          description: `${data.summary.successful} orders fixed successfully`,
        });
      } else {
        throw new Error(data.error || 'Reconciliation failed');
      }
    } catch (error: any) {
      console.error('Emergency reconciliation error:', error);
      toast({
        title: "Reconciliation Failed",
        description: error.message || 'Emergency reconciliation failed',
        variant: "destructive",
      });
    } finally {
      setIsReconciling(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'not_found':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      failed: 'destructive',
      pending: 'secondary',
      not_found: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="w-5 h-5" />
            Emergency Payment Reconciliation
          </CardTitle>
          <CardDescription>
            Use this tool to manually reconcile pending orders with Paystack payment status.
            This will verify payments and update order statuses for stuck transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runEmergencyReconciliation}
            disabled={isReconciling}
            className="flex items-center gap-2"
          >
            {isReconciling ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {isReconciling ? 'Reconciling...' : 'Run Emergency Reconciliation'}
          </Button>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.total_processed}</div>
                <div className="text-sm text-muted-foreground">Total Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.successful}</div>
                <div className="text-sm text-muted-foreground">Fixed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
                <div className="text-sm text-muted-foreground">Still Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{summary.not_found}</div>
                <div className="text-sm text-muted-foreground">Not Found</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Results</CardTitle>
            <CardDescription>
              Detailed results for each order processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <div className="font-medium">{result.order_number}</div>
                      <div className="text-sm text-muted-foreground">{result.reference}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {result.payment_amount && result.order_amount && (
                      <div className="text-sm">
                        ₦{result.payment_amount.toLocaleString()} / ₦{result.order_amount.toLocaleString()}
                      </div>
                    )}
                    {getStatusBadge(result.status)}
                  </div>
                  <div className="max-w-xs text-sm text-muted-foreground truncate">
                    {result.message}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};