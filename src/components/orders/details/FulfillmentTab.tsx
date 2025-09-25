import React from 'react';
import { Card } from '@/components/ui/card';
import { OrderProgressBar } from './OrderProgressBar';

interface FulfillmentTabProps {
  detailedOrderData?: {
    steps?: any[];
    assigned_agent?: {
      name?: string;
    };
    instructions?: string;
  };
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
  if (isLoading) {
    return <div className="text-center py-10">Loading fulfillment data...</div>;
  }
  
  if (error) {
    return <div className="text-destructive">Error loading details.</div>;
  }
  
  if (!detailedOrderData) {
    return <div className="text-muted-foreground">No fulfillment data.</div>;
  }

  return (
    <Card className="border shadow-sm rounded-xl mb-6">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Order Fulfillment Progress</h2>
        <OrderProgressBar steps={detailedOrderData.steps || []} />
        <div className="mt-6">
          <div className="mb-2 font-medium">Assigned Agent</div>
          <div>{detailedOrderData.assigned_agent?.name || 'Unassigned'}</div>
        </div>
        <div className="mt-6">
          <div className="mb-2 font-medium">Instructions</div>
          <div>{detailedOrderData.instructions || 'None'}</div>
        </div>
      </div>
    </Card>
  );
};