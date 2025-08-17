import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

interface RetryButtonProps {
  onRetry: () => void;
  maxRetries?: number;
  currentRetries?: number;
  cooldownSeconds?: number;
  isLoading?: boolean;
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry,
  maxRetries = 3,
  currentRetries = 0,
  cooldownSeconds = 0,
  isLoading = false
}) => {
  const [countdown, setCountdown] = useState(cooldownSeconds);
  const { data: businessSettings } = useBusinessSettings();
  
  const remainingAttempts = maxRetries - currentRetries;
  const canRetry = remainingAttempts > 0 && countdown === 0;
  
  const primaryColor = businessSettings?.primary_color || 'hsl(var(--primary))';

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleRetry = () => {
    if (canRetry && !isLoading) {
      onRetry();
    }
  };

  const getButtonText = () => {
    if (isLoading) return 'Retrying...';
    if (countdown > 0) return `Retry in ${countdown}s`;
    if (remainingAttempts <= 0) return 'No retries left';
    return `Try Again (${remainingAttempts} left)`;
  };

  return (
    <Button 
      onClick={handleRetry}
      disabled={!canRetry || isLoading}
      className="flex items-center gap-2"
      style={{ backgroundColor: canRetry ? primaryColor : undefined }}
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {getButtonText()}
    </Button>
  );
};