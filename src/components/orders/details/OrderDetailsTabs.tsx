import React from 'react';
import { SummaryTab } from './SummaryTab';
import { FulfillmentTab } from './FulfillmentTab';
import { ActionsTab } from './ActionsTab';
import { TimelineTab } from './TimelineTab';
import { OrderHistoryTab } from './OrderHistoryTab';

interface OrderDetailsTabsProps {
  order: any;
  deliverySchedule?: any;
  detailedOrderData?: any;
  isLoading: boolean;
  error?: any;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  isUpdatingStatus: boolean;
  handleStatusUpdate: (status: string) => Promise<void>;
  drivers?: any[];
  driversLoading?: boolean;
  assignedRiderId?: string | null;
  onRiderAssignment?: (riderId: string | null) => Promise<void>;
  isAssigningRider?: boolean;
}

/**
 * OrderDetailsTabs component manages tab navigation and renders appropriate tab content
 * 
 * @param order - Order object with all order information
 * @param deliverySchedule - Delivery schedule information
 * @param detailedOrderData - Detailed order data from API
 * @param isLoading - Loading state for detailed data
 * @param error - Error state for detailed data  
 * @param selectedTab - Currently selected tab
 * @param setSelectedTab - Function to change selected tab
 * @param isUpdatingStatus - Loading state for status updates
 * @param handleStatusUpdate - Function to update order status
 * 
 * @example
 * ```tsx
 * <OrderDetailsTabs
 *   order={order}
 *   deliverySchedule={deliverySchedule}
 *   detailedOrderData={detailedOrderData}
 *   isLoading={false}
 *   selectedTab="summary"
 *   setSelectedTab={setSelectedTab}
 *   isUpdatingStatus={false}
 *   handleStatusUpdate={handleStatusUpdate}
 * />
 * ```
 */
export const OrderDetailsTabs: React.FC<OrderDetailsTabsProps> = ({
  order,
  deliverySchedule,
  detailedOrderData,
  isLoading,
  error,
  selectedTab,
  setSelectedTab,
  isUpdatingStatus,
  handleStatusUpdate,
  drivers,
  driversLoading,
  assignedRiderId,
  onRiderAssignment,
  isAssigningRider,
}) => {
  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'fulfillment', label: 'Fulfillment' },
    { key: 'actions', label: 'Actions' },
    { key: 'history', label: 'History' },
    { key: 'timeline', label: 'Timeline' }
  ];

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b px-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`px-4 py-3 text-sm font-medium focus:outline-none transition-colors ${selectedTab === tab.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setSelectedTab(tab.key)}
            aria-selected={selectedTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {selectedTab === 'summary' && (
          <SummaryTab 
            order={order} 
            deliverySchedule={deliverySchedule}
          />
        )}
        {selectedTab === 'fulfillment' && (
          <FulfillmentTab detailedOrderData={detailedOrderData} isLoading={isLoading} error={error} />
        )}
        {selectedTab === 'actions' && (
          <ActionsTab
            order={order}
            isUpdatingStatus={isUpdatingStatus}
            handleStatusUpdate={handleStatusUpdate}
            drivers={drivers}
            driversLoading={driversLoading}
            assignedRiderId={assignedRiderId}
            onRiderAssignment={onRiderAssignment}
            isAssigningRider={isAssigningRider}
          />
        )}
        {selectedTab === 'history' && (
          <OrderHistoryTab 
            detailedOrderData={detailedOrderData} 
            isLoading={isLoading} 
            error={error} 
            order={order} 
          />
        )}
        {selectedTab === 'timeline' && (
          <TimelineTab detailedOrderData={detailedOrderData} isLoading={isLoading} error={error} order={order} />
        )}
      </div>
    </div>
  );
};