import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, ShieldCheck, Clock } from 'lucide-react';
import { PaymentStatusMonitor } from './PaymentStatusMonitor';
import { ProductionHealthCheck } from './ProductionHealthCheck';
import { usePaymentTimeout } from '@/hooks/usePaymentTimeout';

interface PaymentRecoveryProps {
  reference: string;
  orderData: {
    amount: number;
    email: string;
    orderNumber: string;
  };
  onRecoverySuccess: () => void;
  onRecoveryFailed: () => void;
}

export const PaymentRecovery: React.FC<PaymentRecoveryProps> = ({
  reference,
  orderData,
  onRecoverySuccess,
  onRecoveryFailed
}) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [recoveryStage, setRecoveryStage] = useState<'idle' | 'monitoring' | 'success' | 'failed'>('idle');

  const { resetTimer, clearTimer } = usePaymentTimeout({
    timeoutMs: 120000, // 2 minutes
    onTimeout: () => {
      console.log('⏰ Payment recovery timeout');
      setRecoveryStage('failed');
      onRecoveryFailed();
    },
    isActive: isMonitoring
  });

  const handleStartRecovery = useCallback(() => {
    console.log('🔄 Starting payment recovery for reference:', reference);
    setIsMonitoring(true);
    setRecoveryStage('monitoring');
    resetTimer();
  }, [reference, resetTimer]);

  const handleStatusUpdate = useCallback((status: 'pending' | 'success' | 'failed', data?: any) => {
    console.log('📊 Payment recovery status update:', { status, data });
    
    if (status === 'success') {
      setRecoveryStage('success');
      setIsMonitoring(false);
      clearTimer();
      onRecoverySuccess();
    } else if (status === 'failed') {
      setRecoveryStage('failed');
      setIsMonitoring(false);
      clearTimer();
      onRecoveryFailed();
    }
  }, [clearTimer, onRecoverySuccess, onRecoveryFailed]);

  const handleStopRecovery = useCallback(() => {
    console.log('🛑 Stopping payment recovery');
    setIsMonitoring(false);
    setRecoveryStage('idle');
    clearTimer();
  }, [clearTimer]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Payment Recovery</CardTitle>
              <CardDescription>
                Monitor and recover incomplete payment for order #{orderData.orderNumber}
              </CardDescription>
            </div>
            <Badge variant={recoveryStage === 'success' ? 'default' : recoveryStage === 'failed' ? 'destructive' : 'secondary'}>
              {recoveryStage === 'success' && <CheckCircle className="h-3 w-3 mr-1" />}
              {recoveryStage === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
              {recoveryStage === 'monitoring' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {recoveryStage === 'idle' && <Clock className="h-3 w-3 mr-1" />}
              {recoveryStage.charAt(0).toUpperCase() + recoveryStage.slice(1)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Amount:</span> ₦{orderData.amount.toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Email:</span> {orderData.email}
            </div>
            <div className="col-span-2">
              <span className="font-medium">Reference:</span> 
              <code className="ml-2 text-xs bg-muted px-2 py-1 rounded">{reference}</code>
            </div>
          </div>

          {isMonitoring && (
            <PaymentStatusMonitor
              reference={reference}
              onStatusUpdate={handleStatusUpdate}
              intervalMs={3000}
              maxAttempts={20}
            />
          )}

          <div className="flex gap-2">
            {!isMonitoring && recoveryStage === 'idle' && (
              <Button onClick={handleStartRecovery} size="sm">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Start Recovery
              </Button>
            )}

            {isMonitoring && (
              <Button variant="outline" onClick={handleStopRecovery} size="sm">
                Stop Monitoring
              </Button>
            )}

            <Button 
              variant="outline" 
              onClick={() => setShowHealthCheck(true)} 
              size="sm"
            >
              System Status
            </Button>
          </div>

          {recoveryStage === 'success' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Payment successfully recovered! The transaction has been verified and processed.
              </AlertDescription>
            </Alert>
          )}

          {recoveryStage === 'failed' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Payment recovery failed. The transaction could not be verified. Please try initiating a new payment or contact support.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {showHealthCheck && (
        <div className="mt-6">
          <ProductionHealthCheck />
          <Button 
            variant="outline" 
            onClick={() => setShowHealthCheck(false)}
            className="mt-4"
          >
            Close Health Check
          </Button>
        </div>
      )}
    </div>
  );
};