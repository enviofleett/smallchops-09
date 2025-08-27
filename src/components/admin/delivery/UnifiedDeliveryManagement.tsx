import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  Settings,
  Filter,
  ChevronDown,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UnifiedDeliveryManagementProps {
  mode: 'ready' | 'all';
  selectedDate?: Date;
  typeFilter?: 'all' | 'delivery' | 'pickup';
  statusFilter?: string[];
  ordersOverride?: any[]; // For passing pre-filtered orders (e.g., delivery window filtered)
}

export function UnifiedDeliveryManagement({ 
  mode, 
  selectedDate, 
  typeFilter = 'all',
  statusFilter = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'],
  ordersOverride
}: UnifiedDeliveryManagementProps) {
  const [localStatusFilter, setLocalStatusFilter] = useState<string[]>(statusFilter);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<any>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [typeLocal, setTypeLocal] = useState<'all' | 'delivery' | 'pickup'>(typeFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const { drivers } = useDriverManagement();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Out for delivery' },
    { value: 'delivered', label: 'Delivered' },
  ];

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
    // Use override if provided (for pre-filtered orders like delivery window filter)
    if (ordersOverride) {
      return ordersOverride;
    }

    let orders = ordersData?.orders || [];

    // Apply type filter
    if (typeLocal !== 'all') {
      orders = orders.filter(order => order.order_type === typeLocal);
    }

    // Apply status filter for 'all' mode
    if (mode === 'all') {
      orders = orders.filter(order => localStatusFilter.includes(order.status));
    }

    // Only show paid orders
    orders = orders.filter(order => order.payment_status === 'paid');

    // Apply search filter
    if (debouncedQuery) {
      orders = orders.filter(order => 
        (order.order_number || '').toLowerCase().includes(debouncedQuery) ||
        (order.customer_name || '').toLowerCase().includes(debouncedQuery) ||
        (order.customer_email || '').toLowerCase().includes(debouncedQuery) ||
        (order.customer_phone || '').toLowerCase().includes(debouncedQuery)
      );
    }

    return orders;
  }, [ordersData?.orders, typeLocal, localStatusFilter, mode, ordersOverride, debouncedQuery]);

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
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              {mode === 'ready' ? 'Ready Orders' : 'All Orders'}
            </h2>
            <p className="text-muted-foreground">
              {filteredOrders.length} orders {mode === 'ready' ? 'ready for dispatch' : 'found'}
            </p>
          </div>
        </div>

        {/* Filter Toolbar for All Orders mode */}
        {mode === 'all' && (
          <div className="bg-muted/30 rounded-lg p-3 sm:p-4 space-y-3">
            {/* Search - Full width on mobile */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search orders, customer, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 w-full"
              />
            </div>
            
            {/* Filters Row */}
            <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
              <Select value={typeLocal} onValueChange={(v: 'all'|'delivery'|'pickup') => setTypeLocal(v)}>
                <SelectTrigger className="h-9 w-full xs:w-36">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="pickup">Pickup</SelectItem>
                </SelectContent>
              </Select>

              <Popover open={isStatusOpen} onOpenChange={setIsStatusOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-full xs:w-auto justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      <span className="hidden xs:inline">Status</span>
                      <span className="xs:hidden">
                        {localStatusFilter.length === statusOptions.length ? 'All Status' : 
                         localStatusFilter.length === 0 ? 'No Status' :
                         `${localStatusFilter.length} Selected`}
                      </span>
                      {localStatusFilter.length > 0 && localStatusFilter.length < statusOptions.length && (
                        <span className="inline-flex items-center justify-center text-xs bg-primary text-primary-foreground rounded-full w-5 h-5">
                          {localStatusFilter.length}
                        </span>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 bg-background border shadow-md z-50" align="start">
                  <div className="flex items-center justify-between mb-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocalStatusFilter(statusOptions.map(s => s.value))}
                      className="text-xs h-7"
                    >
                      Select all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocalStatusFilter([])}
                      className="text-xs h-7"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {statusOptions.map(status => {
                      const checked = localStatusFilter.includes(status.value);
                      return (
                        <label key={status.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) =>
                              c
                                ? setLocalStatusFilter(prev => [...prev, status.value])
                                : setLocalStatusFilter(prev => prev.filter(v => v !== status.value))
                            }
                          />
                          <span className="capitalize">{status.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
        
        {selectedOrders.length > 0 && (
          <div className="flex flex-col xs:flex-row gap-2 bg-primary/5 p-3 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 text-sm text-primary font-medium mb-2 xs:mb-0">
              <span>{selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected</span>
            </div>
            <div className="flex flex-col xs:flex-row gap-2 xs:ml-auto">
              <Button
                variant="outline"
                onClick={handleBulkPrint}
                size="sm"
                className="flex items-center gap-2 h-8"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden xs:inline">Print Selected</span>
                <span className="xs:hidden">Print ({selectedOrders.length})</span>
              </Button>
              <Button
                onClick={() => setIsAssignDialogOpen(true)}
                size="sm"
                className="flex items-center gap-2 h-8"
              >
                <Truck className="w-4 h-4" />
                <span className="hidden xs:inline">Assign Driver</span>
                <span className="xs:hidden">Assign ({selectedOrders.length})</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Select all checkbox */}
      {filteredOrders.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
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
              <CardContent className="p-4 sm:p-6">
                {/* Mobile-first header */}
                <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedOrders(prev => [...prev, order.id]);
                        } else {
                          setSelectedOrders(prev => prev.filter(id => id !== order.id));
                        }
                      }}
                      className="mt-1"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      {getStatusIcon(order.status)}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base sm:text-lg truncate">#{order.order_number}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-row xs:flex-col gap-2 xs:items-end">
                    <AdminOrderStatusBadge status={order.status} />
                    <Badge variant={order.order_type === 'delivery' ? 'default' : 'secondary'} className="text-xs">
                      {order.order_type}
                    </Badge>
                  </div>
                </div>

                {/* Mobile-optimized content grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
                  {/* Customer Info */}
                  <div className="bg-muted/20 rounded-lg p-3 space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-sm">
                      <User className="w-4 h-4" />
                      Customer
                    </h4>
                    <div className="text-sm space-y-1">
                      <p className="font-medium truncate">{order.customer_name}</p>
                      <p className="text-muted-foreground truncate text-xs">{order.customer_email}</p>
                      {order.customer_phone && (
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{order.customer_phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="bg-muted/20 rounded-lg p-3 space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4" />
                      Order Details
                    </h4>
                    <div className="text-sm space-y-1">
                      <p className="text-xs text-muted-foreground">{order.order_items?.length || 0} items</p>
                      <p className="font-medium text-primary">₦{order.total_amount.toLocaleString()}</p>
                      {mode === 'all' && (
                        <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 mt-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Status:</span>
                          <Select
                            value={order.status}
                            onValueChange={(value) => handleStatusChange(order.id, value)}
                          >
                            <SelectTrigger className="w-full xs:w-32 h-7 text-xs">
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
                  <div className="bg-muted/20 rounded-lg p-3 space-y-2 sm:col-span-2 lg:col-span-1">
                    <h4 className="font-medium flex items-center gap-2 text-sm">
                      <Truck className="w-4 h-4" />
                      Assignment
                    </h4>
                    {driver ? (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-muted-foreground text-xs">{driver.phone}</p>
                        <p className="text-muted-foreground capitalize text-xs">{driver.vehicle_type}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not assigned</p>
                    )}
                  </div>
                </div>

                {/* Delivery Address */}
                {order.order_type === 'delivery' && order.delivery_address && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="font-medium flex items-center gap-2 mb-2 text-sm text-amber-800">
                      <MapPin className="w-4 h-4" />
                      Delivery Address
                    </h4>
                    <p className="text-sm text-amber-700 leading-relaxed">
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
                <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
                  <div className="flex gap-2 flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsDetailsModalOpen(true);
                      }}
                      className="flex-1 xs:flex-none h-8"
                    >
                      <Eye className="w-4 h-4 xs:mr-1" />
                      <span className="hidden xs:inline">Details</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrint(order)}
                      className="flex-1 xs:flex-none h-8"
                    >
                      <Printer className="w-4 h-4 xs:mr-1" />
                      <span className="hidden xs:inline">Print</span>
                    </Button>
                  </div>
                  
                  {!driver && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedOrders([order.id]);
                        setIsAssignDialogOpen(true);
                      }}
                      className="w-full xs:w-auto h-8"
                    >
                      <Truck className="w-4 h-4 xs:mr-1" />
                      <span className="xs:hidden">Assign Driver</span>
                      <span className="hidden xs:inline">Assign Driver</span>
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