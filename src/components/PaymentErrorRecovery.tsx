import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePaymentRecovery } from '@/hooks/usePaymentRecovery';
import { AlertCircle, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

interface PaymentErrorRecoveryProps {
  initialReference?: string;
  onRecoverySuccess?: (orderData: any) => void;
  onClose?: () => void;
}

export const PaymentErrorRecovery: React.FC<PaymentErrorRecoveryProps> = ({
  initialReference = '',
  onRecoverySuccess,
  onClose
}) => {
  const [reference, setReference] = useState(initialReference);
  const { attemptPaymentRecovery, isRecovering, recoveryHistory } = usePaymentRecovery();

  const handleRecovery = async () => {
    if (!reference.trim()) {
      return;
    }

    const result = await attemptPaymentRecovery(reference.trim());
    
    if (result.success && onRecoverySuccess) {
      onRecoverySuccess(result.order);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-warning" />
          Payment Recovery Assistant
        </CardTitle>
        <CardDescription>
          If your payment went through but the order wasn't updated, enter your payment reference below to recover it.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Recovery Form */}
        <div className="space-y-4">
          <div>
            <label htmlFor="reference" className="text-sm font-medium">
              Payment Reference
            </label>
            <div className="flex gap-2 mt-1">
              <Input
                id="reference"
                placeholder="txn_1234567890_abcd... or pay_1234567890_abcd..."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={isRecovering}
              />
              <Button 
                onClick={handleRecovery}
                disabled={!reference.trim() || isRecovering}
                className="shrink-0"
              >
                {isRecovering ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Recover'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              You can find this reference in your payment confirmation email or transaction history
            </p>
          </div>
        </div>

        {/* Recovery History */}
        {recoveryHistory.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Recent Recovery Attempts</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {recoveryHistory.map((attempt, index) => (
                <div
                  key={`${attempt.reference}-${attempt.timestamp}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm"
                >
                  <div className="shrink-0 mt-0.5">
                    {attempt.success ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {attempt.reference}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTimestamp(attempt.timestamp)}
                      </span>
                    </div>
                    
                    {attempt.error && (
                      <p className="text-destructive text-xs mt-1">{attempt.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            When to use Recovery
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Your payment was successful but order status shows as pending</li>
            <li>You received a payment confirmation but no order confirmation</li>
            <li>The checkout process was interrupted after payment</li>
            <li>You want to check the status of a specific payment reference</li>
          </ul>
        </div>

        {/* Actions */}
        {onClose && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentErrorRecovery;