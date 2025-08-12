import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentVerificationErrorProps {
  onRetry: () => void;
  error: string;
  canRetry?: boolean;
}

export const PaymentVerificationError: React.FC<PaymentVerificationErrorProps> = ({ 
  onRetry, 
  error, 
  canRetry = true 
}) => (
  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
    <div className="flex">
      <AlertTriangle className="h-5 w-5 text-yellow-400" />
      <div className="ml-3">
        <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          Payment Verification Issue
        </h3>
        <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
          {error}
        </p>
        {canRetry && (
          <div className="mt-4">
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700"
            >
              Retry Verification
            </Button>
          </div>
        )}
      </div>
    </div>
  </div>
);