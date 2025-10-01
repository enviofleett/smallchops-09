import React from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { OrderFilterWarning } from '@/types/adminOrders';

interface StatusIndicatorsProps {
  warnings: OrderFilterWarning[];
  onDismiss?: (warningId: string) => void;
}

export const OrdersStatusIndicators: React.FC<StatusIndicatorsProps> = ({ warnings }) => {
  if (warnings.length === 0) return null;

  const missingSchedules = warnings.filter(w => w.type === 'missing_schedule');
  const invalidDates = warnings.filter(w => w.type === 'invalid_date');

  return (
    <div className="space-y-3">
      {missingSchedules.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Delivery Schedules</AlertTitle>
          <AlertDescription>
            {missingSchedules.length} confirmed order{missingSchedules.length > 1 ? 's are' : ' is'} missing delivery schedules. 
            These orders may not appear in time-based filters.
          </AlertDescription>
        </Alert>
      )}

      {invalidDates.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Invalid Delivery Dates</AlertTitle>
          <AlertDescription>
            {invalidDates.length} order{invalidDates.length > 1 ? 's have' : ' has'} invalid delivery dates. 
            Please review and update these orders.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

interface FilterFeedbackProps {
  filterDescription: string;
  count: number;
  totalCount: number;
  onClear?: () => void;
}

export const FilterFeedback: React.FC<FilterFeedbackProps> = ({
  filterDescription,
  count,
  totalCount,
  onClear,
}) => {
  return (
    <Alert>
      <CheckCircle className="h-4 w-4" />
      <AlertTitle>Active Filter</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{filterDescription}</span>
        {onClear && count === 0 && (
          <button 
            onClick={onClear}
            className="text-sm underline hover:no-underline"
          >
            Clear filter
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
};
