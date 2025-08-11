import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentIssue {
  id: string;
  type: 'stuck_order' | 'missing_transaction' | 'payment_mismatch';
  order_id?: string;
  reference?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const PaymentReconciliation: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<PaymentIssue[]>([]);
  const [searchRef, setSearchRef] = useState('');
  const [fixingIssue, setFixingIssue] = useState<string | null>(null);

  const scanForIssues = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-reconcile', {
        body: { action: 'scan_issues' }
      });

      if (error) throw error;

      setIssues(data?.issues || []);
      toast.success(`Found ${data?.issues?.length || 0} payment issues`);
    } catch (error) {
      console.error('Failed to scan for issues:', error);
      toast.error('Failed to scan for payment issues');
    } finally {
      setLoading(false);
    }
  };

  const fixStuckOrder = async (orderId: string) => {
    setFixingIssue(orderId);
    try {
      const { data, error } = await supabase.functions.invoke('payment-reconcile', {
        body: { 
          action: 'fix_stuck_order', 
          order_id: orderId 
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Order status updated successfully');
        // Remove fixed issue from list
        setIssues(prev => prev.filter(issue => issue.order_id !== orderId));
      } else {
        toast.error(data?.message || 'Failed to fix order');
      }
    } catch (error) {
      console.error('Failed to fix stuck order:', error);
      toast.error('Failed to fix stuck order');
    } finally {
      setFixingIssue(null);
    }
  };

  const searchPaymentDetails = async () => {
    if (!searchRef.trim()) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-reconcile', {
        body: { 
          action: 'search_payment', 
          reference: searchRef.trim() 
        }
      });

      if (error) throw error;

      if (data?.found) {
        toast.success('Payment details found');
        // Display payment details in console for debugging
        console.log('Payment Details:', data);
      } else {
        toast.warning('Payment reference not found');
      }
    } catch (error) {
      console.error('Failed to search payment:', error);
      toast.error('Failed to search payment details');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high': 
        return <AlertTriangle className="h-4 w-4" />;
      default: 
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment System Health</CardTitle>
          <CardDescription>
            Monitor and resolve payment processing issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={scanForIssues} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Scan for Issues
            </Button>
            
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Search payment reference..."
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchPaymentDetails()}
              />
              <Button 
                onClick={searchPaymentDetails}
                disabled={loading || !searchRef.trim()}
                variant="outline"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {issues.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Found {issues.length} payment issues requiring attention.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Issues ({issues.length})</CardTitle>
            <CardDescription>
              Issues found during payment processing scan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {issues.map((issue) => (
                <div key={issue.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getSeverityIcon(issue.severity)}
                    <div>
                      <div className="font-medium">{issue.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {issue.order_id && `Order: ${issue.order_id}`}
                        {issue.reference && ` • Reference: ${issue.reference}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor(issue.severity) as any}>
                      {issue.severity}
                    </Badge>
                    {issue.type === 'stuck_order' && issue.order_id && (
                      <Button
                        size="sm"
                        onClick={() => fixStuckOrder(issue.order_id!)}
                        disabled={fixingIssue === issue.order_id}
                      >
                        {fixingIssue === issue.order_id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Fix Order'
                        )}
                      </Button>
                    )}
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