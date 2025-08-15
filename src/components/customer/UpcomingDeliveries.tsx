import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeliveryScheduleCard } from '@/components/orders/DeliveryScheduleCard';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { Calendar, Clock, Package } from 'lucide-react';
import { format, isAfter, startOfDay } from 'date-fns';

export const UpcomingDeliveries: React.FC = () => {
  const { data: ordersData, isLoading } = useCustomerOrders();
  const orders = ordersData?.orders || [];
  const orderIds = orders.map(order => order.id);
  const { schedules } = useOrderDeliverySchedules(orderIds);

  const upcomingDeliveries = React.useMemo(() => {
    if (!orders.length) return [];

    const today = startOfDay(new Date());
    
    return orders
      .filter(order => {
        const schedule = schedules[order.id];
        if (!schedule) return false;
        
        const deliveryDate = new Date(schedule.delivery_date);
        return isAfter(deliveryDate, today) || format(deliveryDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      })
      .map(order => ({
        ...order,
        schedule: schedules[order.id]!
      }))
      .sort((a, b) => new Date(a.schedule.delivery_date).getTime() - new Date(b.schedule.delivery_date).getTime());
  }, [orders, schedules]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (upcomingDeliveries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Deliveries
          </CardTitle>
          <CardDescription>
            Your scheduled deliveries will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No upcoming deliveries scheduled</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Upcoming Deliveries
        </CardTitle>
        <CardDescription>
          {upcomingDeliveries.length} delivery{upcomingDeliveries.length === 1 ? '' : 'ies'} scheduled
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingDeliveries.map(({ schedule, ...order }) => (
          <div key={order.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Order #{order.order_number}</p>
                <p className="text-sm text-gray-600">
                  {order.order_items?.length || 0} item{(order.order_items?.length || 0) === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">₦{order.total_amount.toLocaleString()}</p>
              </div>
            </div>
            <DeliveryScheduleCard 
              schedule={schedule} 
              orderStatus={order.status}
              className="border-l-4 border-l-blue-500 bg-blue-50/50"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};