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
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex items-center gap-2">
        <Truck className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Delivery Date:</span>
      </div>
      
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-56 bg-background border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-background border-border z-50">
          <SelectItem value="all" className="hover:bg-muted cursor-pointer">
            <div className="flex items-center justify-between w-full">
              <span>All Orders</span>
              {orderCounts && (
                <Badge variant="secondary" className="ml-2">
                  {orderCounts.all}
                </Badge>
              )}
            </div>
          </SelectItem>
          
          <SelectItem value="today" className="hover:bg-muted cursor-pointer">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>Today</span>
              </div>
              {orderCounts && (
                <Badge variant="secondary" className="ml-2">
                  {orderCounts.today}
                </Badge>
              )}
            </div>
          </SelectItem>
          
          <SelectItem value="tomorrow" className="hover:bg-muted cursor-pointer">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>Tomorrow</span>
              </div>
              {orderCounts && (
                <Badge variant="secondary" className="ml-2">
                  {orderCounts.tomorrow}
                </Badge>
              )}
            </div>
          </SelectItem>
          
          <SelectItem value="future" className="hover:bg-muted cursor-pointer">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>Future</span>
              </div>
              {orderCounts && (
                <Badge variant="secondary" className="ml-2">
                  {orderCounts.future}
                </Badge>
              )}
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};