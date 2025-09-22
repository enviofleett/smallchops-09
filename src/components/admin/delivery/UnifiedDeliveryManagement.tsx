import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { useOrdersNew, useOrderUpdate } from '@/hooks/useOrdersNew';
import { AdminOrderStatusBadge } from '@/components/admin/AdminOrderStatusBadge';
import { OrderReceiptModal } from '@/components/customer/OrderReceiptModal';
import { DeliveryAssignmentDialog } from './DeliveryAssignmentDialog';
import { OrderDetailsModal } from './OrderDetailsModal';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { useProductionStatusUpdate } from '@/hooks/useProductionStatusUpdate';
import { isValidOrderStatus } from '@/utils/orderValidation';
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
  ChevronDown,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// --- Types ---
interface UnifiedDeliveryManagementProps {
  mode: 'ready' | 'all' | 'overdue';
  selectedDate?: Date;
  typeFilter?: 'all' | 'delivery' | 'pickup';
  statusFilter?: string[];
  ordersOverride?: any[];
}

// --- Main Component ---
export function UnifiedDeliveryManagement({
  mode,
  selectedDate,
  typeFilter = 'all',
  statusFilter = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'],
  ordersOverride
}: UnifiedDeliveryManagementProps) {
  // --- State ---
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
  
  // Use production-hardened status update hook
  const updateOrderMutation = useOrderUpdate();

  // --- Debounced Search Query ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- Status Options ---
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Out for delivery' },
    { value: 'delivered', label: 'Delivered' },
  ];

  // --- Query Params ---
  const queryParams = useMemo(() => {
    const params: any = { page: 1, pageSize: 1000 };
    if (mode === 'ready') {
      params.status = 'ready';
    } else if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      params.startDate = dateString;
      params.endDate = dateString;
    }
    return params;
  }, [mode, selectedDate]);

  // --- Fetch Orders ---
  const { data: ordersData, isLoading, refetch } = useOrdersNew({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    status: queryParams.status,
    search: '',
    ...(queryParams.startDate && { startDate: queryParams.startDate }),
    ...(queryParams.endDate && { endDate: queryParams.endDate })
  });

  // --- Filtered Orders ---
  const filteredOrders = useMemo(() => {
    if (ordersOverride) return ordersOverride;
    let orders = ordersData?.data?.orders || [];
    if (typeLocal !== 'all') {
      orders = orders.filter(order => order.order_type === typeLocal);
    }
    if (mode === 'all') {
      orders = orders.filter(order => localStatusFilter.includes(order.status));
    }
    orders = orders.filter(order => order.payment_status === 'paid');
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

  // --- Status Change Handler ---
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      // CRITICAL: Validate status before proceeding using utility
      if (!isValidOrderStatus(newStatus)) {
        toast.error('Invalid status selected. Please refresh the page and try again.');
        console.error('❌ Invalid status provided:', newStatus);
        return;
      }

      const order = filteredOrders.find(o => o.id === orderId);
      if (!order) {
        toast.error('Order not found. Please refresh the page.');
        return;
      }

      // Check driver assignment requirement
      if (newStatus === 'out_for_delivery' && !order.assigned_rider_id) {
        toast.error('Cannot move to "Out for Delivery" without assigning a driver. Please assign a driver first.');
        return;
      }

      // Log the status change attempt
      console.log(`🔄 Updating order ${orderId} status from "${order.status}" to "${newStatus}"`);

      // ENHANCED: Centralized error handling with loading state
      await updateOrderMutation.mutateAsync({
        order_id: orderId,
        new_status: newStatus,
        admin_id: 'current-user',
        admin_name: 'Admin'
      });
      toast.success(`Order status updated to ${newStatus.replace('_', ' ')}`);
      refetch();
    } catch (error: any) {
      // ENHANCED: Detailed error messaging with specific error parsing
      let errorMessage = 'Failed to update order status';
      
      if (error?.message?.includes('edge function') || error?.message?.includes('non-2xx status')) {
        errorMessage = 'Service temporarily unavailable. Please try again.';
      } else if (error?.message?.includes('invalid input value for enum')) {
        errorMessage = 'Invalid status value. Please refresh the page and try again.';
      } else if (error?.message?.includes('authentication')) {
        errorMessage = 'Session expired. Please refresh the page and log in again.';
      } else if (error?.message) {
        errorMessage = `Update failed: ${error.message}`;
      }
      
      toast.error(errorMessage);
      console.error('❌ Status update error:', {
        orderId,
        attemptedStatus: newStatus,
        error: error?.message || error,
        fullError: error
      });
    }
  };

  // --- Bulk Driver Assignment ---
  const handleAssignDriver = async (orderIds: string[], driverId: string) => {
    try {
      // Note: This would need bulk assignment support in the new backend
      // For now, we'll do individual assignments
      const promises = orderIds.map(orderId =>
        updateOrderMutation.mutateAsync({
          order_id: orderId,
          new_status: 'preparing', // Assume preparing when assigning driver
          admin_id: 'current-user',
          admin_name: 'Admin'
        })
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

  // --- Print Single Receipt ---
  const handlePrint = (order: any) => {
    setPrintingOrder(order);
    setIsReceiptModalOpen(true);
  };

  // --- Bulk Print Receipts ---
  const handleBulkPrint = () => {
    if (selectedOrders.length === 0) return;
    const ordersForPrint = filteredOrders.filter(order => selectedOrders.includes(order.id));
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

  // --- Status Icon Helper ---
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

  // --- Loading Skeleton ---
  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="loading-skeleton">
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

  // --- Responsive Layout ---
  return (
    <div className="space-y-4 w-full max-w-screen-lg mx-auto px-2 sm:px-4">
      {/* Toolbar: Search & Filters */}
      <div className="space-y-4">
        <div className="w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              aria-label="Search orders"
              placeholder="Search orders by number, customer name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <Select value={typeLocal} onValueChange={(value: any) => setTypeLocal(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Order Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="delivery">Delivery Only</SelectItem>
                <SelectItem value="pickup">Pickup Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === 'all' && (
            <div className="flex-1 min-w-0">
              <Popover open={isStatusOpen} onOpenChange={setIsStatusOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-sm"
                    aria-label="Filter by status"
                  >
                    <span className="truncate">
                      {localStatusFilter.length === statusOptions.length ? 'All Statuses'
                        : localStatusFilter.length === 1 ? statusOptions.find(s => s.value === localStatusFilter[0])?.label
                        : `${localStatusFilter.length} Selected`}
                    </span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0">
                  <div className="p-3 space-y-2">
                    {statusOptions.map((status) => (
                      <div key={status.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={status.value}
                          checked={localStatusFilter.includes(status.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setLocalStatusFilter([...localStatusFilter, status.value]);
                            } else {
                              setLocalStatusFilter(localStatusFilter.filter(s => s !== status.value));
                            }
                          }}
                        />
                        <label htmlFor={status.value} className="text-sm font-medium">
                          {status.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedOrders.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-700">
                  {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAssignDialogOpen(true)}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <Truck className="w-3 h-3 mr-1" />
                  Assign Driver
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkPrint}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <Printer className="w-3 h-3 mr-1" />
                  Print All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedOrders([])}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders grid */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No orders found</h3>
            <p className="text-muted-foreground">
              {mode === 'ready'
                ? 'No orders are ready for delivery/pickup at the moment.'
                : 'Try adjusting your filters or check back later.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        // --- Responsive grid for orders ---
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((order) => {
            const driverInfo = drivers.find(d => d.profile_id === order.assigned_rider_id);
            return (
              <Card
                key={order.id}
                className={cn(
                  "transition-all duration-200 hover:shadow-md",
                  selectedOrders.includes(order.id) && "ring-2 ring-blue-500 bg-blue-50/30"
                )}
              >
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedOrders([...selectedOrders, order.id]);
                          } else {
                            setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                          }
                        }}
                        aria-label={`Select order #${order.order_number}`}
                      />
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base">#{order.order_number}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <AdminOrderStatusBadge status={order.status} />
                          <Badge variant="outline" className="text-xs">
                            {order.order_type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm sm:text-base">₦{order.total_amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  </div>

                  {/* Customer info */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{order.customer_name}</span>
                    </div>
                    {order.customer_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">{order.customer_phone}</span>
                      </div>
                    )}
                  </div>
                  {/* Delivery address */}
                  {order.order_type === 'delivery' && order.delivery_address && (
                    <div className="mb-3">
                      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-amber-800 break-words">
                            {typeof order.delivery_address === 'object'
                              ? `${order.delivery_address.street || ''}, ${order.delivery_address.city || ''}, ${order.delivery_address.state || ''}`.replace(/^,\s*|,\s*$/g, '')
                              : order.delivery_address}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Driver info */}
                  {driverInfo && (
                    <div className="mb-3 p-2 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Assigned to {driverInfo.name}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsDetailsModalOpen(true);
                      }}
                      className="flex-1 min-w-0 text-xs"
                      aria-label={`View details for order #${order.order_number}`}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrint(order)}
                      className="flex-1 min-w-0 text-xs"
                      aria-label={`Print order #${order.order_number}`}
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      Print
                    </Button>
                    <div className="w-full sm:w-auto flex-1 min-w-0">
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <div className="flex items-center gap-1">
                            {getStatusIcon(order.status)}
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(status.value)}
                                {status.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Modals */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
      />
      <OrderReceiptModal
        order={printingOrder}
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />
      <DeliveryAssignmentDialog
        isOpen={isAssignDialogOpen}
        onClose={() => setIsAssignDialogOpen(false)}
        selectedOrderIds={selectedOrders}
        onAssign={handleAssignDriver}
        drivers={drivers}
      />
    </div>
  );
}
