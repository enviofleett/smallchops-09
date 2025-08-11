import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export const EmergencyPaymentFix: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  const runEmergencyFix = async () => {
    setIsLoading(true);
    try {
      console.log('🚨 Running emergency fix for test order...');
      
      const { data, error } = await supabase.functions.invoke('emergency-payment-fix', {
        body: { action: 'fix_test_order' }
      });

      if (error) {
        console.error('Emergency fix error:', error);
        throw error;
      }

      console.log('Emergency fix result:', data);
      setResult(data);

      if (data.success) {
        toast.success('Emergency fix completed successfully!');
      } else {
        toast.error('Emergency fix failed: ' + data.error);
      }
    } catch (error: any) {
      console.error('Emergency fix failed:', error);
      toast.error('Emergency fix failed: ' + error.message);
      setResult({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Emergency Payment Fix
        </CardTitle>
        <CardDescription>
          Fix the stuck test order ORD-20250811-8222
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-800">Test Order Details</h4>
          <p className="text-sm text-yellow-700 mt-1">
            Order: ORD-20250811-8222<br />
            Reference: txn_1754906935502_dda21f55-7931-4bd3-b012-180c53e398d2<br />
            Status: Currently stuck in pending
          </p>
        </div>

        <Button
          onClick={runEmergencyFix}
          disabled={isLoading}
          className="w-full"
          variant="destructive"
        >
          {isLoading ? 'Fixing...' : 'Run Emergency Fix'}
        </Button>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription>
              {result.success ? (
                <div>
                  <strong>Success!</strong> {result.message}
                  {result.data && (
                    <div className="mt-2 text-sm">
                      <p>Order ID: {result.data.order_id}</p>
                      <p>Amount: ₦{result.data.amount}</p>
                      <p>Status: {result.data.status}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <strong>Failed:</strong> {result.error}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-muted-foreground">
          <p>This will:</p>
          <ul className="list-disc list-inside mt-1">
            <li>Create the missing payment transaction record</li>
            <li>Update order status to "confirmed"</li>
            <li>Set payment status to "paid"</li>
            <li>Log the recovery action for audit</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmergencyPaymentFix;