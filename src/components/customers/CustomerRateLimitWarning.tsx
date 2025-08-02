import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Clock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CustomerRateLimitWarningProps {
  remainingActions: number;
  resetTime: Date | null;
  isAllowed: boolean;
  onRefresh?: () => void;
}

export const CustomerRateLimitWarning: React.FC<CustomerRateLimitWarningProps> = ({
  remainingActions,
  resetTime,
  isAllowed,
  onRefresh
}) => {
  if (isAllowed && remainingActions > 10) {
    return null; // Don't show warning if plenty of actions remaining
  }

  const formatTimeUntilReset = () => {
    if (!resetTime) return 'Unknown';
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    const minutes = Math.ceil(diff / (1000 * 60));
    return minutes > 0 ? `${minutes} minutes` : 'Soon';
  };

  if (!isAllowed) {
    return (
      <Alert variant="destructive" className="mb-4">
        <Shield className="h-4 w-4" />
        <AlertTitle>Rate Limit Exceeded</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <p>
            You have reached the maximum number of customer operations for this hour. 
            This limit helps protect the system and ensures fair usage.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Resets in: {formatTimeUntilReset()}
            </span>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                Check Again
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 border-yellow-200 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="text-yellow-800">Rate Limit Warning</AlertTitle>
      <AlertDescription className="text-yellow-700">
        <div className="flex flex-col gap-2">
          <p>
            You have {remainingActions} customer operations remaining this hour.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Limit resets in: {formatTimeUntilReset()}
            </span>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                Refresh Status
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};