import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, Clock, Gift, AlertTriangle, CheckCircle } from 'lucide-react';

interface PromotionFeedbackProps {
  type: 'success' | 'error' | 'warning' | 'rate-limited';
  message: string;
  description?: string;
  attemptsRemaining?: number;
  blockedUntil?: string;
  promotionName?: string;
  savingsAmount?: number;
}

export const PromotionFeedback: React.FC<PromotionFeedbackProps> = ({
  type,
  message,
  description,
  attemptsRemaining,
  blockedUntil,
  promotionName,
  savingsAmount
}) => {
  const getAlertVariant = () => {
    switch (type) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'rate-limited':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'rate-limited':
        return <Shield className="h-4 w-4 text-red-600" />;
      default:
        return <Gift className="h-4 w-4" />;
    }
  };

  const getTimeRemaining = () => {
    if (!blockedUntil) return null;
    
    const blocked = new Date(blockedUntil);
    const now = new Date();
    const diff = blocked.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const minutes = Math.ceil(diff / (1000 * 60));
    return minutes;
  };

  const timeRemaining = getTimeRemaining();

  return (
    <Alert variant={getAlertVariant()} className="my-3">
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1">
          <AlertTitle className="flex items-center gap-2 text-sm">
            {message}
            {type === 'success' && savingsAmount && (
              <Badge variant="secondary" className="text-xs">
                <Gift className="w-3 h-3 mr-1" />
                Saved ₦{savingsAmount.toLocaleString()}
              </Badge>
            )}
            {attemptsRemaining !== undefined && attemptsRemaining > 0 && (
              <Badge variant="outline" className="text-xs ml-auto">
                <Shield className="w-3 h-3 mr-1" />
                {attemptsRemaining} attempts left
              </Badge>
            )}
          </AlertTitle>
          
          {description && (
            <AlertDescription className="text-sm mt-1">
              {description}
            </AlertDescription>
          )}
          
          {type === 'rate-limited' && timeRemaining && (
            <AlertDescription className="text-sm mt-2 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Try again in {timeRemaining} minute{timeRemaining > 1 ? 's' : ''}
            </AlertDescription>
          )}
          
          {promotionName && type === 'success' && (
            <AlertDescription className="text-sm mt-1 text-green-700">
              "{promotionName}" promotion has been applied to your cart
            </AlertDescription>
          )}
        </div>
      </div>
    </Alert>
  );
};