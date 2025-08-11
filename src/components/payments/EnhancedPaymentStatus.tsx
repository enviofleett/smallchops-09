import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EnhancedPaymentStatusProps {
  isProcessing: boolean;
  paymentStatus: 'idle' | 'initiated' | 'pending' | 'verifying' | 'success' | 'failed';
  progress: number;
  message: string;
  pollCount?: number;
  nextPollIn?: number;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const EnhancedPaymentStatus: React.FC<EnhancedPaymentStatusProps> = ({
  isProcessing,
  paymentStatus,
  progress,
  message,
  pollCount = 0,
  nextPollIn = 0,
  onRetry,
  onCancel,
  className = ''
}) => {
  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'success':
        return <CheckCircle className="h-8 w-8 text-success" />;
      case 'failed':
        return <XCircle className="h-8 w-8 text-destructive" />;
      case 'verifying':
        return <Loader2 className="h-8 w-8 text-primary animate-spin" />;
      case 'pending':
        return <Clock className="h-8 w-8 text-warning" />;
      case 'initiated':
        return <CreditCard className="h-8 w-8 text-primary" />;
      default:
        return <Clock className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'success':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'pending':
      case 'verifying':
        return 'warning';
      case 'initiated':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getStatusText = () => {
    switch (paymentStatus) {
      case 'initiated':
        return 'Payment Initiated';
      case 'pending':
        return 'Payment Pending';
      case 'verifying':
        return 'Verifying Payment';
      case 'success':
        return 'Payment Successful';
      case 'failed':
        return 'Payment Failed';
      default:
        return 'Ready';
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          {getStatusIcon()}
        </div>
        <CardTitle className="text-lg">
          <Badge variant={getStatusColor() as any} className="text-sm px-3 py-1">
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {isProcessing && paymentStatus !== 'idle' && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress}% Complete</span>
              {pollCount > 0 && (
                <span>Check #{pollCount}</span>
              )}
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            {message}
          </p>
          
          {/* Next Poll Countdown */}
          {nextPollIn > 0 && paymentStatus === 'pending' && (
            <p className="text-xs text-muted-foreground">
              Next check in {formatTime(nextPollIn)}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        {(paymentStatus === 'failed' || paymentStatus === 'idle') && (onRetry || onCancel) && (
          <div className="flex gap-2 pt-2">
            {onRetry && (
              <Button 
                onClick={onRetry} 
                variant="default" 
                size="sm" 
                className="flex-1"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Retry Payment'
                )}
              </Button>
            )}
            
            {onCancel && (
              <Button 
                onClick={onCancel} 
                variant="outline" 
                size="sm" 
                className="flex-1"
                disabled={isProcessing}
              >
                Cancel
              </Button>
            )}
          </div>
        )}

        {/* Success/Error Additional Info */}
        {paymentStatus === 'success' && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
            <p className="text-sm text-success-foreground">
              Your payment has been successfully processed and confirmed.
            </p>
          </div>
        )}

        {paymentStatus === 'failed' && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
            <p className="text-sm text-destructive-foreground">
              Payment could not be processed. Please try again or contact support.
            </p>
          </div>
        )}

        {/* Real-time Indicator */}
        {isProcessing && paymentStatus === 'pending' && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <span>Real-time monitoring active</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedPaymentStatus;