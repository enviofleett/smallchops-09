import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Mail } from 'lucide-react';

interface DeliveryWindowCriticalErrorProps {
  orderId?: string;
  errorMessage?: string;
  onRetry?: () => void;
  showContactSupport?: boolean;
}

/**
 * Critical error component for missing delivery windows.
 * This should only be shown when there's a data integrity issue.
 */
export const DeliveryWindowCriticalError: React.FC<DeliveryWindowCriticalErrorProps> = ({
  orderId,
  errorMessage = 'Delivery window information is missing for this order.',
  onRetry,
  showContactSupport = true,
}) => {
  const handleContactSupport = () => {
    const subject = encodeURIComponent(`Critical: Missing Delivery Window - Order ${orderId || 'Unknown'}`);
    const body = encodeURIComponent(
      `Hello,\n\nI'm experiencing a critical issue with order ${orderId || 'Unknown'}.\n\nIssue: ${errorMessage}\n\nPlease investigate this data integrity issue.\n\nThank you.`
    );
    window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`;
  };

  return (
    <Alert variant="destructive" className="border-red-600 bg-red-50">
      <AlertTriangle className="h-5 w-5 text-red-600" />
      <AlertTitle className="text-red-900 font-semibold">
        Critical Data Error
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="text-red-800">
          <p className="font-medium">{errorMessage}</p>
          <p className="text-sm mt-1">
            This is a system error that requires immediate attention. Delivery orders must have valid delivery windows.
          </p>
          {orderId && (
            <p className="text-xs mt-1 font-mono bg-red-100 px-2 py-1 rounded inline-block">
              Order ID: {orderId}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-red-600 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Loading
            </Button>
          )}
          
          {showContactSupport && (
            <Button
              variant="default"
              size="sm"
              onClick={handleContactSupport}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Mail className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
