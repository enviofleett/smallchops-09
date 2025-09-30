import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ComprehensiveOrderFulfillment } from '@/components/orders/details/ComprehensiveOrderFulfillment';
import { AlertCircle } from 'lucide-react';

interface FulfillmentTabProps {
  detailedOrderData?: any;
  isLoading: boolean;
  error?: any;
}

/**
 * FulfillmentTab component displays order fulfillment progress, assigned agent and instructions
 * 
 * @param detailedOrderData - Detailed order data containing steps, agent and instructions
 * @param isLoading - Loading state for data fetching
 * @param error - Error state for data fetching
 * 
 * @example
 * ```tsx
 * const detailedOrderData = {
 *   steps: [
 *     { status: "confirmed", timestamp: "2025-09-25T18:30:00Z" },
 *     { status: "preparing", timestamp: "2025-09-25T19:00:00Z" }
 *   ],
 *   assigned_agent: { name: "Sarah Johnson" },
 *   instructions: "Handle with care. Customer prefers contactless delivery."
 * };
 * 
 * <FulfillmentTab detailedOrderData={detailedOrderData} isLoading={false} />
 * ```
 */
export const FulfillmentTab: React.FC<FulfillmentTabProps> = ({
  detailedOrderData,
  isLoading,
  error
}) => {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load fulfillment details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="bg-card rounded-lg border shadow-sm">
      <div className="p-6">
        <ComprehensiveOrderFulfillment 
          data={detailedOrderData || {}}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};