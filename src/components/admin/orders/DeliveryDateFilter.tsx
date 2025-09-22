import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Truck, Clock, AlertTriangle } from 'lucide-react';
import { DeliveryFilterType, getFilterStats } from '@/utils/dateFilterUtils';
import { OrderWithItems } from '@/api/orders';

interface DeliveryDateFilterProps {
  value: DeliveryFilterType;
  onChange: (value: DeliveryFilterType) => void;
  orders: OrderWithItems[];
  deliverySchedules: Record<string, any>;
  showCounts?: boolean;
}

export const DeliveryDateFilter: React.FC<DeliveryDateFilterProps> = ({
  value,
  onChange,
  orders,
  deliverySchedules,
  showCounts = true
}) => {
  // Calculate real-time filter statistics
  const filterStats = useMemo(() => {
    if (!showCounts || !orders.length) {
      return {
        all: 0,
        today: 0,
        tomorrow: 0,
        future: 0,
        past_due: 0,
        upcoming: 0,
        this_week: 0,
        next_week: 0
      };
    }
    
    try {
      return getFilterStats(orders, deliverySchedules);
    } catch (error) {
      console.error('Error calculating filter stats:', error);
      return {
        all: orders.length,
        today: 0,
        tomorrow: 0,
        future: 0,
        past_due: 0,
        upcoming: 0,
        this_week: 0,
        next_week: 0
      };
    }
  }, [orders, deliverySchedules, showCounts]);

  // Filter options with improved labeling and icons
  const filterOptions = [
    { 
      value: 'all' as DeliveryFilterType, 
      label: 'All Orders', 
      icon: Truck, 
      count: filterStats.all,
      description: 'All orders regardless of delivery date'
    },
    { 
      value: 'today' as DeliveryFilterType, 
      label: 'Today', 
      icon: Calendar, 
      count: filterStats.today,
      description: 'Orders scheduled for delivery today',
      priority: filterStats.today > 0 ? 'high' : 'normal'
    },
    { 
      value: 'tomorrow' as DeliveryFilterType, 
      label: 'Tomorrow', 
      icon: Calendar, 
      count: filterStats.tomorrow,
      description: 'Orders scheduled for delivery tomorrow'
    },
    { 
      value: 'future' as DeliveryFilterType, 
      label: 'Future', 
      icon: Clock, 
      count: filterStats.future,
      description: 'Orders scheduled for delivery after tomorrow'
    },
    { 
      value: 'past_due' as DeliveryFilterType, 
      label: 'Past Due', 
      icon: AlertTriangle, 
      count: filterStats.past_due,
      description: 'Orders that were scheduled for past dates',
      priority: filterStats.past_due > 0 ? 'urgent' : 'normal'
    },
    { 
      value: 'this_week' as DeliveryFilterType, 
      label: 'This Week', 
      icon: Calendar, 
      count: filterStats.this_week,
      description: 'Orders scheduled for this week'
    },
    { 
      value: 'next_week' as DeliveryFilterType, 
      label: 'Next Week', 
      icon: Calendar, 
      count: filterStats.next_week,
      description: 'Orders scheduled for next week'
    }
  ];

  const selectedOption = filterOptions.find(option => option.value === value) || filterOptions[0];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex items-center gap-2">
        <selectedOption.icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filter by Delivery Date:</span>
        {selectedOption.priority === 'urgent' && (
          <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
        )}
      </div>
      
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-64 bg-background border-border">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <selectedOption.icon className="w-4 h-4" />
              <SelectValue />
            </div>
            {showCounts && selectedOption.count > 0 && (
              <Badge 
                variant={selectedOption.priority === 'urgent' ? 'destructive' : 
                        selectedOption.priority === 'high' ? 'default' : 'secondary'}
                className="ml-2"
              >
                {selectedOption.count}
              </Badge>
            )}
          </div>
        </SelectTrigger>
        <SelectContent className="bg-background border-border z-50 w-80">
          {filterOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value} 
              className="hover:bg-muted cursor-pointer py-3"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <option.icon className={`w-4 h-4 ${
                    option.priority === 'urgent' ? 'text-destructive' :
                    option.priority === 'high' ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </div>
                {showCounts && (
                  <Badge 
                    variant={option.priority === 'urgent' ? 'destructive' : 
                            option.priority === 'high' ? 'default' : 'secondary'}
                    className="ml-2"
                  >
                    {option.count}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Filter description */}
      {selectedOption.description && (
        <div className="text-xs text-muted-foreground max-w-md">
          {selectedOption.description}
          {showCounts && selectedOption.count > 0 && (
            <span className="font-medium ml-1">
              ({selectedOption.count} {selectedOption.count === 1 ? 'order' : 'orders'})
            </span>
          )}
        </div>
      )}
    </div>
  );
};