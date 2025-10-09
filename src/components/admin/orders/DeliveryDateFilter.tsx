import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Truck } from 'lucide-react';
import { DeliveryFilterType } from '@/utils/dateFilterUtils';
interface DeliveryDateFilterProps {
  value: DeliveryFilterType;
  onChange: (value: DeliveryFilterType) => void;
  orderCounts?: {
    all: number;
    today: number;
    tomorrow: number;
    future: number;
  };
}
export const DeliveryDateFilter: React.FC<DeliveryDateFilterProps> = ({
  value,
  onChange,
  orderCounts
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4" />
          <SelectValue placeholder="Filter by delivery" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center justify-between w-full gap-3">
            <span>All Deliveries</span>
            {orderCounts && <Badge variant="secondary">{orderCounts.all}</Badge>}
          </div>
        </SelectItem>
        <SelectItem value="today">
          <div className="flex items-center justify-between w-full gap-3">
            <span>Today</span>
            {orderCounts && <Badge variant="secondary">{orderCounts.today}</Badge>}
          </div>
        </SelectItem>
        <SelectItem value="tomorrow">
          <div className="flex items-center justify-between w-full gap-3">
            <span>Tomorrow</span>
            {orderCounts && <Badge variant="secondary">{orderCounts.tomorrow}</Badge>}
          </div>
        </SelectItem>
        <SelectItem value="future">
          <div className="flex items-center justify-between w-full gap-3">
            <span>Future</span>
            {orderCounts && <Badge variant="secondary">{orderCounts.future}</Badge>}
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};