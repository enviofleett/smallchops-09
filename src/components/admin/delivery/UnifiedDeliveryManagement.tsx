import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { getOrders, updateOrder } from '@/api/orders';
import { AdminOrderStatusBadge } from '@/components/admin/AdminOrderStatusBadge';
import { OrderReceiptModal } from '@/components/customer/OrderReceiptModal';
import { DeliveryAssignmentDialog } from './DeliveryAssignmentDialog';
import { OrderDetailsModal } from './OrderDetailsModal';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { 
  Package, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Truck,
  AlertCircle,
  CheckCircle2,
  Printer,
  Eye,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UnifiedDeliveryManagementProps {
  mode: 'ready' | 'all';
  selectedDate?: Date;
  typeFilter?: 'all' | 'delivery' | 'pickup';
  statusFilter?: string[];
}

export function UnifiedDeliveryManagement({ 
  mode, 
  selectedDate, 
  typeFilter = 'all',
  statusFilter = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']
}: UnifiedDeliveryManagementProps) {
  const [localStatusFilter, setLocalStatusFilter] = useState<string[]>(statusFilter);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<any>(null);

  const { drivers } = useDriverManagement();

  // Build query parameters based on mode
  const queryParams = useMemo(() => {
    const params: any = {
      page: 1,
      pageSize: 1000,
    };

    if (mode === 'ready') {
      params.status = 'ready';
    } else {
      // For 'all' mode, don't set status to get multiple statuses
      if (selectedDate) {
        const dateString = format(selectedDate, 'yyyy-MM-dd');
        params.startDate = dateString;
        params.endDate = dateString;
      }
    }

    return params;
  }, [mode, selectedDate]);

  // Fetch orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['unified-orders', mode, selectedDate?.toISOString(), typeFilter, statusFilter],
    queryFn: () => getOrders(queryParams),
    refetchInterval: mode === 'ready' ? 30000 : undefined, // Auto-refresh ready orders
  });

  // Filter orders based on mode and filters
  const filteredOrders = useMemo(() => {
    let orders = ordersData?.orders || [];

    // Apply type filter
    if (typeFilter !== 'all') {
      orders = orders.filter(order => order.order_type === typeFilter);
    }

    // Apply status filter for 'all' mode
    if (mode === 'all') {
      orders = orders.filter(order => localStatusFilter.includes(order.status));
    }

    // Only show paid orders
    orders = orders.filter(order => order.payment_status === 'paid');

    return orders;
  }, [ordersData?.orders, typeFilter, localStatusFilter, mode]);

  // Handle status change with validation
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const order = filteredOrders.find(o => o.id === orderId);
      
      // Validate status transitions
      if (newStatus === 'out_for_delivery' && !order?.assigned_rider_id) {
        toast.error('Cannot move to "Out for Delivery" without assigning a driver. Please assign a driver first.');
        return;
      }
      
      await updateOrder(orderId, { status: newStatus as any });
      toast.success('Order status updated successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to update order status');
      console.error('Status update error:', error);
    }
  };

  // Handle driver assignment
  const handleAssignDriver = async (orderIds: string[], driverId: string) => {
    try {
      // Use the updated assignment method that handles profile_id mapping
      const promises = orderIds.map(orderId => 
        updateOrder(orderId, { assigned_rider_id: driverId }) // driverId is now profile_id
      );
      
      await Promise.all(promises);
      toast.success(`${orderIds.length} order(s) assigned successfully`);
      refetch();
      setSelectedOrders([]);
    } catch (error) {
      toast.error('Failed to assign driver');
      console.error('Assignment error:', error);
    }
  };

  // Handle print
  const handlePrint = (order: any) => {
    setPrintingOrder(order);
    setIsReceiptModalOpen(true);
  };

  // Handle bulk print
  const handleBulkPrint = () => {
    if (selectedOrders.length === 0) return;
    
    const ordersForPrint = filteredOrders.filter(order => 
      selectedOrders.includes(order.id)
    );
    
    // Create a print window with multiple receipts
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Order Receipts</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .receipt { border: 1px solid #ccc; margin-bottom: 20px; padding: 20px; page-break-after: always; }
            .receipt:last-child { page-break-after: auto; }
            h2 { margin-top: 0; }
            @media print { .receipt { page-break-after: always; } }
          </style>
        </head>
        <body>
          ${ordersForPrint.map(order => `
            <div class="receipt">
              <h2>Order Receipt #${order.order_number}</h2>
              <p><strong>Customer:</strong> ${order.customer_name}</p>
              <p><strong>Email:</strong> ${order.customer_email}</p>
              <p><strong>Phone:</strong> ${order.customer_phone || 'N/A'}</p>
              <p><strong>Type:</strong> ${order.order_type}</p>
              <p><strong>Status:</strong> ${order.status}</p>
              <p><strong>Total:</strong> ₦${order.total_amount.toLocaleString()}</p>
              <p><strong>Date:</strong> ${format(new Date(order.created_at), 'PPpp')}</p>
              ${order.delivery_address ? `<p><strong>Address:</strong> ${typeof order.delivery_address === 'object' ? JSON.stringify(order.delivery_address) : order.delivery_address}</p>` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle2 className="w-4 h-4" />;
      case 'out_for_delivery': return <Truck className="w-4 h-4" />;
      case 'ready': return <Package className="w-4 h-4" />;
      case 'preparing': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle2 className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (isLoading) {
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            {mode === 'ready' ? 'Ready Orders' : 'All Orders'}
          </h2>
          <p className="text-muted-foreground">
            {filteredOrders.length} orders {mode === 'ready' ? 'ready for dispatch' : 'found'}
          </p>
        </div>

        {/* Status Filter for All Orders mode */}
        {mode === 'all' && (
          <div className="flex flex-wrap gap-2">
            <p className="text-sm font-medium text-muted-foreground">Status Filters:</p>
            {['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'].map((status) => (
              <label key={status} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={localStatusFilter.includes(status)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setLocalStatusFilter(prev => [...prev, status]);
                    } else {
                      setLocalStatusFilter(prev => prev.filter(s => s !== status));
                    }
                  }}
                  className="w-3 h-3"
                />
                <span className="capitalize">{status.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        )}
        
        {selectedOrders.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleBulkPrint}
              className="flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Selected ({selectedOrders.length})
            </Button>
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
      {filteredOrders.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-lg">
          <Checkbox
            checked={selectedOrders.length === filteredOrders.length}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedOrders(filteredOrders.map(o => o.id));
              } else {
                setSelectedOrders([]);
              }
            }}
          />
          <span className="text-sm font-medium">
            Select all orders ({filteredOrders.length})
          </span>
        </div>
      )}

      {/* Orders list */}
      <div className="space-y-4">
        {filteredOrders.map((order) => {
          const driver = order.assigned_rider_id ? 
            drivers.find(d => d.id === order.assigned_rider_id) : null;

          return (
            <Card key={order.id} className={cn(
              "transition-all duration-200 hover:shadow-md",
              mode === 'ready' && "border-l-4 border-l-orange-500"
            )}>
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
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.status)}
                      <div>
                        <h3 className="font-semibold text-lg">#{order.order_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <AdminOrderStatusBadge status={order.status} />
                    <Badge variant={order.order_type === 'delivery' ? 'default' : 'secondary'}>
                      {order.order_type}
                    </Badge>
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
                      {order.customer_phone && (
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {order.customer_phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Order Details
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>{order.order_items?.length || 0} items</p>
                      <p className="font-medium">₦{order.total_amount.toLocaleString()}</p>
                      {mode === 'all' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs">Status:</span>
                          <Select
                            value={order.status}
                            onValueChange={(value) => handleStatusChange(order.id, value)}
                          >
                            <SelectTrigger className="w-32 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="preparing">Preparing</SelectItem>
                              <SelectItem value="ready">Ready</SelectItem>
                              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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
                      {typeof order.delivery_address === 'object' && !Array.isArray(order.delivery_address)
                        ? `${(order.delivery_address as any).address_line_1 || ''}, ${(order.delivery_address as any).city || ''}`.trim()
                        : typeof order.delivery_address === 'string' 
                          ? order.delivery_address
                          : 'Address available'
                      }
                    </p>
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
                    <Eye className="w-4 h-4 mr-1" />
                    Details
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrint(order)}
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    Print
                  </Button>
                  
                  {!driver && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedOrders([order.id]);
                        setIsAssignDialogOpen(true);
                      }}
                    >
                      <Truck className="w-4 h-4 mr-1" />
                      Assign Driver
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
            <p className="text-muted-foreground">
              {mode === 'ready' 
                ? 'No orders are currently ready for dispatch.' 
                : 'No orders match the current filters.'
              }
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

      {printingOrder && (
        <OrderReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setPrintingOrder(null);
          }}
          order={printingOrder}
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
    </div>
  );
}