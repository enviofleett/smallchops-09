import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { updateOrder } from '@/api/orders';
import { OrderStatus } from '@/types/orders';
import { assignRiderToOrder } from '@/api/assignments';
import { ComprehensiveDeliveryInfo } from '@/components/orders/ComprehensiveDeliveryInfo';
import { useOrderDeliveryInfo } from '@/hooks/useOrderDeliveryInfo';
import { toast } from 'sonner';
import { 
  Clock, 
  MapPin, 
  User, 
  Package, 
  Truck,
  AlertTriangle,
  CheckCircle,
  Phone,
  Calendar
} from 'lucide-react';
import { format, differenceInHours, isAfter } from 'date-fns';

interface DeliveryOrderCardProps {
  order: any;
  onUpdate?: () => void;
  showDriverAssignment?: boolean;
  showStatusChange?: boolean;
}

export function DeliveryOrderCard({ 
  order, 
  onUpdate,
  showDriverAssignment = true,
  showStatusChange = true 
}: DeliveryOrderCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { drivers } = useDriverManagement();
  const { data: deliveryInfo, isLoading: loadingDelivery } = useOrderDeliveryInfo(order.id);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  // Check if order is urgent (within 2 hours of scheduled delivery)
  const isUrgent = () => {
    if (!deliveryInfo?.delivery_schedule) return false;
    
    const scheduledTime = new Date(`${deliveryInfo.delivery_schedule.delivery_date}T${deliveryInfo.delivery_schedule.delivery_time_start}`);
    const hoursUntilDelivery = differenceInHours(scheduledTime, new Date());
    
    return hoursUntilDelivery <= 2 && hoursUntilDelivery >= 0;
  };

  // Get status configuration
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return { 
          label: 'Delivered', 
          className: 'bg-green-100 text-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      case 'out_for_delivery':
        return { 
          label: 'Out for Delivery', 
          className: 'bg-blue-100 text-blue-800',
          icon: Truck,
          iconColor: 'text-blue-600'
        };
      case 'preparing':
        return { 
          label: 'Preparing', 
          className: 'bg-yellow-100 text-yellow-800',
          icon: Package,
          iconColor: 'text-yellow-600'
        };
      case 'confirmed':
        return { 
          label: 'Confirmed', 
          className: 'bg-blue-100 text-blue-800',
          icon: CheckCircle,
          iconColor: 'text-blue-600'
        };
      case 'ready':
        return { 
          label: 'Ready for Pickup', 
          className: 'bg-purple-100 text-purple-800',
          icon: Package,
          iconColor: 'text-purple-600'
        };
      default:
        return { 
          label: 'Pending', 
          className: 'bg-gray-100 text-gray-800',
          icon: Clock,
          iconColor: 'text-gray-600'
        };
    }
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  const urgent = isUrgent();

  // Handle driver assignment
  const handleDriverAssignment = async (driverId: string) => {
    if (!driverId || driverId === 'unassign') {
      return;
    }

    setIsUpdating(true);
    try {
      await assignRiderToOrder(order.id, driverId);
      toast.success('Driver assigned successfully');
      onUpdate?.();
    } catch (error) {
      console.error('Error assigning driver:', error);
      toast.error('Failed to assign driver');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === order.status) return;

    setIsUpdating(true);
    try {
      await updateOrder(order.id, { status: newStatus as OrderStatus });
      toast.success(`Order status updated to ${newStatus.replace('_', ' ')}`);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  // Get available status transitions
  const getAvailableStatuses = (currentStatus: string) => {
    switch (currentStatus) {
      case 'confirmed':
        return ['preparing', 'ready'];
      case 'preparing':
        return ['ready', 'out_for_delivery'];
      case 'ready':
        return ['out_for_delivery'];
      case 'out_for_delivery':
        return ['delivered'];
      default:
        return [];
    }
  };

  const availableStatuses = getAvailableStatuses(order.status);
  const assignedDriver = drivers.find(d => d.id === order.assigned_rider_id);

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${urgent ? 'border-l-4 border-l-red-500' : ''}`}>
      {urgent && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Urgent: Delivery due within 2 hours</span>
          </div>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <StatusIcon className={`h-5 w-5 ${statusConfig.iconColor} flex-shrink-0`} />
              <h3 className="text-lg font-semibold text-gray-900">
                Order #{order.order_number}
              </h3>
              <Badge className={`${statusConfig.className} text-xs`}>
                {statusConfig.label}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>{format(new Date(order.order_time), 'MMM d, h:mm a')}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{order.customer_name}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 flex-shrink-0" />
                <span>{order.order_items?.length || 0} items</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Delivery Information */}
        {!loadingDelivery && deliveryInfo && (
          <ComprehensiveDeliveryInfo 
            deliveryInfo={deliveryInfo as any}
            showTitle={false}
            className="bg-gray-50 rounded-lg"
          />
        )}

        {/* Driver Assignment and Status Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Driver Assignment */}
          {showDriverAssignment && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Assigned Driver</label>
              {assignedDriver ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{assignedDriver.name}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Phone className="h-3 w-3" />
                        <span>{assignedDriver.phone}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDriverAssignment('unassign')}
                    disabled={isUpdating}
                    className="text-red-600 hover:text-red-700"
                  >
                    Unassign
                  </Button>
                </div>
              ) : (
                <Select 
                  onValueChange={handleDriverAssignment}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.filter(d => d.is_active).map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <span>{driver.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {driver.vehicle_type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Status Management */}
          {showStatusChange && availableStatuses.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Update Status</label>
              <Select 
                onValueChange={handleStatusChange}
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((status) => {
                    const config = getStatusConfig(status);
                    return (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          <config.icon className={`h-4 w-4 ${config.iconColor}`} />
                          <span>{config.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Scheduled Delivery Time (if urgent) */}
        {urgent && deliveryInfo?.delivery_schedule && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-700">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                Scheduled: {format(new Date(`${deliveryInfo.delivery_schedule.delivery_date}T${deliveryInfo.delivery_schedule.delivery_time_start}`), 'h:mm a')}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}