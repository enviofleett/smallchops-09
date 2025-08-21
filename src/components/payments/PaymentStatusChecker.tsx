import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { verifyPayment, PaymentVerificationResult } from '@/utils/paymentVerification';
import { PaymentRecoveryUtil } from '@/utils/paymentRecovery';

export const PaymentStatusChecker = () => {
  const [reference, setReference] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<PaymentVerificationResult | null>(null);
  const [recoveryHistory, setRecoveryHistory] = useState<string[]>([]);

  const handleCheck = async () => {
    if (!reference.trim()) return;

    setIsChecking(true);
    setResult(null);
    setRecoveryHistory([]);

    try {
      const verificationResult = await verifyPayment(reference.trim());
      setResult(verificationResult);
      
      // Check if there's stored payment data for recovery
      if (PaymentRecoveryUtil.hasPaymentInProgress()) {
        const storedData = PaymentRecoveryUtil.getStoredPaymentData();
        if (storedData) {
          setRecoveryHistory([`Found stored data: ${storedData.reference}`]);
        }
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'An error occurred while checking payment status'
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Payment Status Checker
          </CardTitle>
          <CardDescription>
            Enter a payment reference to check its status and recover payment information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reference">Payment Reference</Label>
            <Input
              id="reference"
              placeholder="txn_1234567890_uuid-here or checkout_sessionid"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            />
          </div>
          
          <Button 
            onClick={handleCheck} 
            disabled={!reference.trim() || isChecking}
            className="w-full"
          >
            {isChecking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking Status...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Check Payment Status
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Payment Status
              <Badge variant={getStatusColor(result.data?.status || 'unknown')}>
                {getStatusIcon(result.data?.status || 'unknown')}
                <span className="ml-1">
                  {result.success ? result.data?.status?.toUpperCase() : 'NOT FOUND'}
                </span>
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success && result.data ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Amount:</span>
                  <div>₦{result.data.amount.toLocaleString()}</div>
                </div>
                <div>
                  <span className="font-medium">Channel:</span>
                  <div className="capitalize">{result.data.channel}</div>
                </div>
                <div>
                  <span className="font-medium">Customer:</span>
                  <div>{result.data.customer?.email || 'N/A'}</div>
                </div>
                <div>
                  <span className="font-medium">Paid At:</span>
                  <div>{result.data.paid_at ? new Date(result.data.paid_at).toLocaleString() : 'N/A'}</div>
                </div>
                {result.data.order_number && (
                  <div className="col-span-2">
                    <span className="font-medium">Order Number:</span>
                    <div>{result.data.order_number}</div>
                  </div>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {result.message || 'Payment not found'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {recoveryHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recovery Attempts</CardTitle>
            <CardDescription>
              Recovery methods used to find this payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recoveryHistory.map((item, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-2 border rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="font-medium">
                      {item}
                    </span>
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