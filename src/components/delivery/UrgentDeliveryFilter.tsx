import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Filter } from 'lucide-react';
import { differenceInHours } from 'date-fns';

interface UrgentDeliveryFilterProps {
  orders: any[];
  onFilterChange: (filteredOrders: any[]) => void;
  isActive: boolean;
  onToggle: () => void;
}

export function UrgentDeliveryFilter({ 
  orders, 
  onFilterChange, 
  isActive, 
  onToggle 
}: UrgentDeliveryFilterProps) {
  
  // Filter orders that are urgent (within 2 hours of scheduled delivery)
  const getUrgentOrders = () => {
    return orders.filter(order => {
      // Only check delivery orders that are not yet delivered
      if (order.order_type !== 'delivery' || order.status === 'delivered') {
        return false;
      }
      
      // Check if order has delivery schedule
      if (!order.delivery_schedule) {
        return false;
      }
      
      try {
        const scheduledTime = new Date(`${order.delivery_schedule.delivery_date}T${order.delivery_schedule.delivery_time_start}`);
        const hoursUntilDelivery = differenceInHours(scheduledTime, new Date());
        
        // Urgent if within 2 hours and in the future
        return hoursUntilDelivery <= 2 && hoursUntilDelivery >= 0;
      } catch (error) {
        console.error('Error parsing delivery schedule:', error);
        return false;
      }
    });
  };

  const urgentOrders = getUrgentOrders();
  const urgentCount = urgentOrders.length;

  const handleToggle = () => {
    if (!isActive) {
      // Apply urgent filter
      onFilterChange(urgentOrders);
    } else {
      // Remove filter (show all orders)
      onFilterChange(orders);
    }
    onToggle();
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className={`
          transition-all duration-200
          ${isActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'hover:bg-red-50 hover:border-red-200'}
        `}
      >
        <AlertTriangle className={`h-4 w-4 mr-2 ${isActive ? 'text-white' : 'text-red-600'}`} />
        <span className="hidden sm:inline">Urgent Deliveries</span>
        <span className="sm:hidden">Urgent</span>
        {urgentCount > 0 && (
          <Badge 
            variant="secondary" 
            className={`
              ml-2 h-5 min-w-[20px] px-1.5
              ${isActive ? 'bg-red-500 text-white' : 'bg-red-100 text-red-800'}
            `}
          >
            {urgentCount}
          </Badge>
        )}
      </Button>

      {urgentCount > 0 && !isActive && (
        <div className="flex items-center gap-2 text-red-600 animate-pulse">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium hidden sm:inline">
            {urgentCount} delivery{urgentCount !== 1 ? 'ies' : 'y'} due within 2 hours
          </span>
          <span className="text-sm font-medium sm:hidden">
            {urgentCount} urgent
          </span>
        </div>
      )}

      {isActive && (
        <div className="flex items-center gap-2 text-gray-600">
          <Filter className="h-4 w-4" />
          <span className="text-sm">
            Showing {urgentCount} urgent order{urgentCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}