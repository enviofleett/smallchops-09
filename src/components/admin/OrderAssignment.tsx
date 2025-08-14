import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useDispatchManagement } from '@/hooks/useDispatchManagement';
import { getOrders } from '@/api/orders';
import { User, MapPin, Phone, Clock, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: any;
  total_amount: number;
  status: string;
  assigned_rider_id?: string;
  created_at: string;
  order_items?: any[];
}

export const OrderAssignment = () => {
  const { 
    drivers, 
    loading: driversLoading, 
    assignRider, 
    fetchDrivers 
  } = useDispatchManagement();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<Record<string, string>>({});

  // Fetch orders that are ready for assignment
  const fetchUnassignedOrders = async () => {
    setLoading(true);
    try {
      const response = await getOrders({
        page: 1,
        pageSize: 50,
        status: 'ready'
      });
      
      // Filter orders that don't have riders assigned yet
      const unassigned = response.orders.filter(order => !order.assigned_rider_id);
      setOrders(unassigned);
      console.log('✅ Fetched', unassigned.length, 'unassigned orders');
    } catch (error) {
      console.error('❌ Failed to fetch orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // Handle individual order assignment
  const handleAssignOrder = async (orderId: string, riderId: string) => {
    const success = await assignRider(orderId, riderId);
    if (success) {
      // Remove the assigned order from the list
      setOrders(prev => prev.filter(order => order.id !== orderId));
      // Clear the selection
      setSelectedAssignments(prev => {
        const updated = { ...prev };
        delete updated[orderId];
        return updated;
      });
    }
  };

  // Handle bulk assignment
  const handleBulkAssignment = async () => {
    const assignments = Object.entries(selectedAssignments).map(([orderId, riderId]) => ({
      orderId,
      riderId
    }));

    if (assignments.length === 0) {
      toast.warning('Please select riders for orders before bulk assignment');
      return;
    }

    const results = await Promise.allSettled(
      assignments.map(({ orderId, riderId }) => assignRider(orderId, riderId))
    );

    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - successful;

    // Remove successfully assigned orders
    const successfulOrderIds = assignments
      .filter((_, index) => results[index].status === 'fulfilled')
      .map(assignment => assignment.orderId);
      
    setOrders(prev => prev.filter(order => !successfulOrderIds.includes(order.id)));
    setSelectedAssignments({});

    const message = `Bulk assignment: ${successful} successful, ${failed} failed`;
    if (failed === 0) {
      toast.success(message);
    } else {
      toast.warning(message);
    }
  };

  // Format delivery address
  const formatAddress = (address: any): string => {
    if (!address) return 'Address not provided';
    if (typeof address === 'string') return address;
    return `${address.street || ''} ${address.city || ''}`.trim() || 'Address incomplete';
  };

  useEffect(() => {
    fetchUnassignedOrders();
    fetchDrivers();
  }, []);

  if (loading || driversLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading orders and drivers...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Assignment ({orders.length} unassigned)
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={fetchUnassignedOrders}
              disabled={loading}
            >
              Refresh Orders
            </Button>
            <Button 
              onClick={handleBulkAssignment}
              disabled={Object.keys(selectedAssignments).length === 0}
            >
              Bulk Assign ({Object.keys(selectedAssignments).length})
            </Button>
          </div>
        </CardHeader>
      </Card>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No unassigned orders</p>
              <p className="text-sm">All ready orders have been assigned to riders</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id} className="border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Order Information */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          Order #{order.order_number}
                          <Badge variant="outline">Ready</Badge>
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()} at{' '}
                          {new Date(order.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">
                          ₦{order.total_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{order.customer_name}</span>
                        </div>
                        {order.customer_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{order.customer_phone}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span className="text-sm">{formatAddress(order.delivery_address)}</span>
                        </div>
                      </div>
                    </div>

                    {order.order_items && order.order_items.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Order Items:</p>
                        <div className="text-sm text-muted-foreground">
                          {order.order_items.slice(0, 3).map((item: any, index: number) => (
                            <span key={index}>
                              {item.quantity}x {item.product_name}
                              {index < Math.min(order.order_items.length, 3) - 1 && ', '}
                            </span>
                          ))}
                          {order.order_items.length > 3 && (
                            <span> and {order.order_items.length - 3} more items</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assignment Section */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Assign Dispatch Rider
                      </label>
                      <Select
                        value={selectedAssignments[order.id] || ''}
                        onValueChange={(value) => 
                          setSelectedAssignments(prev => ({ ...prev, [order.id]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a rider" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{driver.name}</span>
                                <Badge variant="secondary" className="ml-2">
                                  {driver.vehicle_type}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={() => handleAssignOrder(order.id, selectedAssignments[order.id])}
                      disabled={!selectedAssignments[order.id]}
                      className="w-full"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Assign Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};