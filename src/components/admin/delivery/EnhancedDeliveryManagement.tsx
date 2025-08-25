import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { 
  Package, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Truck,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { toast } from 'sonner';
import { OrderDetailsModal } from './OrderDetailsModal';
import { DeliveryAssignmentDialog } from './DeliveryAssignmentDialog';
import { DeliveryStatusDialog } from './DeliveryStatusDialog';

interface ReadyOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_type: 'delivery' | 'pickup';
  total_amount: number;
  status: string;
  delivery_address: any;
  order_items: any[];
  assigned_rider_id?: string;
  delivery_schedule?: {
    delivery_date: string;
    delivery_time_start: string;
    delivery_time_end: string;
    is_flexible: boolean;
    special_instructions?: string;
  };
  created_at: string;
}

interface DeliveryAssignment {
  id: string;
  order_id: string;
  driver_id: string;
  status: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  assigned_at: string;
  estimated_delivery_time?: string;
  delivery_notes?: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  is_active: boolean;
}

export function EnhancedDeliveryManagement() {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ReadyOrder | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<DeliveryAssignment | null>(null);

  const { drivers } = useDriverManagement();

  // Fetch ready orders
  const { data: readyOrders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['ready-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('status', 'ready')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ReadyOrder[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch delivery schedules for ready orders
  const { data: deliverySchedules = {} } = useQuery({
    queryKey: ['delivery-schedules', readyOrders.map(o => o.id)],
    queryFn: async () => {
      if (readyOrders.length === 0) return {};
      
      const { data, error } = await supabase
        .from('order_delivery_schedule')
        .select('*')
        .in('order_id', readyOrders.map(o => o.id));

      if (error) throw error;
      
      return data.reduce((acc, schedule) => {
        acc[schedule.order_id] = schedule;
        return acc;
      }, {} as Record<string, any>);
    },
    enabled: readyOrders.length > 0,
  });

  // Fetch delivery assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['delivery-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select('*')
        .in('order_id', readyOrders.map(o => o.id));

      if (error) throw error;
      return data as DeliveryAssignment[];
    },
    enabled: readyOrders.length > 0,
  });

  // Merge orders with their schedules and assignments
  const enhancedOrders = useMemo(() => {
    return readyOrders.map(order => ({
      ...order,
      delivery_schedule: deliverySchedules[order.id],
      assignment: assignments.find(a => a.order_id === order.id),
    }));
  }, [readyOrders, deliverySchedules, assignments]);

  // Handle driver assignment
  const handleAssignDriver = async (orderIds: string[], driverId: string) => {
    try {
        const results = await Promise.all(
        orderIds.map(orderId => 
          supabase.rpc('assign_driver_to_order', {
            p_order_id: orderId,
            p_driver_id: driverId,
          })
        )
      );

      const successCount = results.filter(r => {
        const data = r.data as any;
        return data?.success;
      }).length;
      
      if (successCount > 0) {
        toast.success(`${successCount} order(s) assigned successfully`);
        refetchOrders();
        setSelectedOrders([]);
      }
      
      const failedResults = results.filter(r => {
        const data = r.data as any;
        return !data?.success;
      });
      if (failedResults.length > 0) {
        failedResults.forEach(result => {
          const data = result.data as any;
          toast.error(data?.error || 'Assignment failed');
        });
      }
    } catch (error) {
      toast.error('Failed to assign driver');
      console.error('Assignment error:', error);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (assignmentId: string, status: string, notes?: string) => {
    try {
      const { data, error } = await supabase.rpc('update_delivery_status', {
        p_assignment_id: assignmentId,
        p_status: status,
        p_notes: notes,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast.success('Status updated successfully');
        refetchOrders();
        setIsStatusDialogOpen(false);
      } else {
        toast.error(result?.error || 'Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
      console.error('Status update error:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      assigned: { color: 'bg-blue-500', label: 'Assigned' },
      accepted: { color: 'bg-green-500', label: 'Accepted' },
      in_progress: { color: 'bg-orange-500', label: 'In Progress' },
      completed: { color: 'bg-emerald-500', label: 'Completed' },
      failed: { color: 'bg-red-500', label: 'Failed' },
      cancelled: { color: 'bg-gray-500', label: 'Cancelled' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.assigned;
    
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const getDriverInfo = (driverId: string) => {
    return drivers.find(d => d.id === driverId);
  };

  if (ordersLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with bulk actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Ready Orders</h2>
          <p className="text-muted-foreground">
            {enhancedOrders.length} orders ready for delivery/pickup
          </p>
        </div>
        
        {selectedOrders.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={() => setIsAssignDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              Assign Driver ({selectedOrders.length})
            </Button>
          </div>
        )}
      </div>

      {/* Select all checkbox */}
      {enhancedOrders.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-lg">
          <Checkbox
            checked={selectedOrders.length === enhancedOrders.length}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedOrders(enhancedOrders.map(o => o.id));
              } else {
                setSelectedOrders([]);
              }
            }}
          />
          <span className="text-sm font-medium">
            Select all orders ({enhancedOrders.length})
          </span>
        </div>
      )}

      {/* Orders list */}
      <div className="space-y-4">
        {enhancedOrders.map((order) => {
          const driver = order.assigned_rider_id ? getDriverInfo(order.assigned_rider_id) : null;
          const schedule = order.delivery_schedule;
          const assignment = order.assignment;

          return (
            <Card key={order.id} className="border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedOrders(prev => [...prev, order.id]);
                        } else {
                          setSelectedOrders(prev => prev.filter(id => id !== order.id));
                        }
                      }}
                    />
                    <div>
                      <h3 className="font-semibold text-lg">#{order.order_number}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={order.order_type === 'delivery' ? 'default' : 'secondary'}>
                      {order.order_type}
                    </Badge>
                    {assignment && getStatusBadge(assignment.status)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {/* Customer Info */}
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Customer
                    </h4>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{order.customer_name}</p>
                      <p className="text-muted-foreground">{order.customer_email}</p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {order.customer_phone}
                      </p>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Order Details
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>{order.order_items.length} items</p>
                      <p className="font-medium">₦{order.total_amount.toLocaleString()}</p>
                      {schedule && (
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {schedule.delivery_time_start} - {schedule.delivery_time_end}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Assignment/Driver Info */}
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Assignment
                    </h4>
                    {driver ? (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-muted-foreground">{driver.phone}</p>
                        <p className="text-muted-foreground capitalize">{driver.vehicle_type}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not assigned</p>
                    )}
                  </div>
                </div>

                {/* Delivery Address */}
                {order.order_type === 'delivery' && order.delivery_address && (
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4" />
                      Delivery Address
                    </h4>
                    <p className="text-sm">
                      {order.delivery_address.address_line_1}, {order.delivery_address.city}
                    </p>
                    {schedule?.special_instructions && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Instructions: {schedule.special_instructions}
                      </p>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setIsDetailsModalOpen(true);
                    }}
                  >
                    View Details
                  </Button>
                  
                  {!driver && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedOrders([order.id]);
                        setIsAssignDialogOpen(true);
                      }}
                    >
                      Assign Driver
                    </Button>
                  )}
                  
                  {assignment && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAssignment(assignment);
                        setIsStatusDialogOpen(true);
                      }}
                    >
                      Update Status
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {enhancedOrders.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Ready Orders</h3>
            <p className="text-muted-foreground">
              All orders are either being prepared or already dispatched.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modals and Dialogs */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedOrder(null);
          }}
        />
      )}

      <DeliveryAssignmentDialog
        isOpen={isAssignDialogOpen}
        onClose={() => {
          setIsAssignDialogOpen(false);
          setSelectedOrders([]);
        }}
        selectedOrderIds={selectedOrders}
        onAssign={handleAssignDriver}
        drivers={drivers.filter(d => d.is_active)}
      />

      {selectedAssignment && (
        <DeliveryStatusDialog
          isOpen={isStatusDialogOpen}
          onClose={() => {
            setIsStatusDialogOpen(false);
            setSelectedAssignment(null);
          }}
          assignment={selectedAssignment}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
}