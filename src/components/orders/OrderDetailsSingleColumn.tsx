import React, { useState, useMemo, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDetailedOrderData } from "@/hooks/useDetailedOrderData";
import { useUpdateOrderStatus } from "@/hooks/useUpdateOrderStatus";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDispatchRiders, updateOrder } from "@/api/orders";
import { sendOrderStatusEmail } from "@/utils/sendOrderStatusEmail";
import { toast } from "sonner";
import { 
  Printer, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Package, 
  Truck,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2
} from "lucide-react";
import { OrderStatus, OrderType } from "@/types/orderDetailsModal";

interface OrderDetailsSingleColumnProps {
  orderId: string;
  adminEmail?: string;
}

// Constants
const STATUS_COLORS = {
  pending: "bg-yellow-500",
  confirmed: "bg-blue-500", 
  preparing: "bg-orange-500",
  ready: "bg-purple-500",
  out_for_delivery: "bg-indigo-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
  refunded: "bg-gray-500",
  completed: "bg-green-600",
  returned: "bg-red-400"
} as const;

const STATUS_OPTIONS: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 
  'delivered', 'cancelled', 'refunded', 'completed', 'returned'
];

const RETRY_CONFIG = {
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

// Utility functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0
  }).format(amount);
};

const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^(\+234|0)[789]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ''));
};

const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

// Loading skeleton component
const OrderDetailsSkeleton = memo(() => (
  <div className="max-w-2xl mx-auto p-6 space-y-6">
    {[1, 2, 3, 4].map((i) => (
      <Card key={i}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    ))}
  </div>
));

OrderDetailsSkeleton.displayName = 'OrderDetailsSkeleton';

// Error fallback component
const ErrorFallback = memo(({ error, onRetry }: { error: Error; onRetry: () => void }) => (
  <div className="max-w-2xl mx-auto p-6">
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Failed to load order details: {error.message}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  </div>
));

ErrorFallback.displayName = 'ErrorFallback';

// Main component
const OrderDetailsSingleColumn = memo(({ orderId, adminEmail }: OrderDetailsSingleColumnProps) => {
  // State
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Query client
  const queryClient = useQueryClient();

  // Data fetching
  const { 
    data: orderData, 
    isLoading, 
    error, 
    refetch,
    isRefetching 
  } = useDetailedOrderData(orderId, RETRY_CONFIG);

  const { updateStatus, isUpdating } = useUpdateOrderStatus(orderId);
  
  // Fetch dispatch riders conditionally
  const { data: dispatchRiders, isLoading: ridersLoading } = useQuery({
    queryKey: ['dispatch-riders'],
    queryFn: getDispatchRiders,
    enabled: orderData?.order?.order_type === 'delivery',
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...RETRY_CONFIG
  });

  // Mutations
  const updateOrderMutation = useMutation({
    mutationFn: updateOrder,
    onSuccess: (data) => {
      toast.success("Order updated successfully");
      queryClient.invalidateQueries({ queryKey: ['detailed-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] }); // Invalidate orders list
    },
    onError: (error: any) => {
      console.error('Order update failed:', error);
      toast.error(`Failed to update order: ${error?.message || 'Unknown error'}`);
    }
  });

  // Memoized calculations
  const orderSummary = useMemo(() => {
    if (!orderData?.order || !orderData?.items) return null;
    
    const { order, items } = orderData;
    const deliveryFee = order.delivery_fee || 0;
    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    
    return { subtotal, deliveryFee, total: order.total_amount || 0 };
  }, [orderData]);

  // Event handlers
  const handleStatusChange = useCallback(async (newStatus: OrderStatus) => {
    if (!orderData?.order) return;
    
    try {
      const success = await updateStatus(newStatus);
      if (success && orderData.order.customer_email) {
        try {
          await sendOrderStatusEmail({
            to: orderData.order.customer_email,
            orderData: orderData.order,
            status: newStatus,
            adminEmail: adminEmail || 'admin@example.com'
          });
          toast.success("Status updated and customer notified!");
        } catch (emailError) {
          console.warn('Email notification failed:', emailError);
          toast.warning("Status updated but email notification failed");
        }
      }
    } catch (error) {
      console.error('Status update failed:', error);
      toast.error("Failed to update order status");
    }
  }, [orderData, updateStatus, adminEmail]);

  const handleRiderAssignment = useCallback((riderId: string) => {
    if (!riderId.trim()) return;
    
    updateOrderMutation.mutate({
      orderId,
      updates: { assigned_rider_id: riderId }
    });
  }, [orderId, updateOrderMutation]);

  const handlePhoneUpdate = useCallback(() => {
    const sanitizedPhone = sanitizeInput(newPhone);
    
    if (!sanitizedPhone) {
      setPhoneError("Phone number is required");
      return;
    }
    
    if (!validatePhoneNumber(sanitizedPhone)) {
      setPhoneError("Please enter a valid Nigerian phone number");
      return;
    }
    
    updateOrderMutation.mutate({
      orderId,
      updates: { customer_phone: sanitizedPhone }
    });
    
    setEditingPhone(false);
    setNewPhone("");
    setPhoneError("");
  }, [newPhone, orderId, updateOrderMutation]);

  const handlePhoneEditStart = useCallback(() => {
    setNewPhone(orderData?.order?.customer_phone || "");
    setEditingPhone(true);
    setPhoneError("");
  }, [orderData?.order?.customer_phone]);

  const handlePhoneEditCancel = useCallback(() => {
    setEditingPhone(false);
    setNewPhone("");
    setPhoneError("");
  }, []);

  const handlePrint = useCallback(() => {
    try {
      window.print();
    } catch (error) {
      console.error('Print failed:', error);
      toast.error("Print functionality unavailable");
    }
  }, []);

  // Loading state
  if (isLoading) return <OrderDetailsSkeleton />;
  
  // Error state
  if (error) return <ErrorFallback error={error as Error} onRetry={refetch} />;
  
  // No data state
  if (!orderData?.order) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Order not found. The order may have been deleted or you may not have permission to view it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { order, items, fulfillment_info } = orderData;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">#{order.order_number}</CardTitle>
                {isRefetching && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${STATUS_COLORS[order.status]} text-white`}>
                  {order.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {order.order_type.toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  LIVE
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isRefetching}>
              <Printer className="w-4 h-4" />
              <span className="sr-only">Print order</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Name</Label>
              <p className="text-sm">{order.customer_name || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Type</Label>
              <p className="text-sm">Guest Customer</p>
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <p className="text-sm break-all">{order.customer_email || 'N/A'}</p>
          </div>

          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone
            </Label>
            {editingPhone ? (
              <div className="space-y-2 mt-1">
                <div className="flex gap-2">
                  <Input
                    value={newPhone}
                    onChange={(e) => {
                      setNewPhone(e.target.value);
                      if (phoneError) setPhoneError("");
                    }}
                    placeholder="e.g., +2348012345678"
                    className={`flex-1 ${phoneError ? 'border-red-500' : ''}`}
                    disabled={updateOrderMutation.isPending}
                  />
                  <Button 
                    size="sm" 
                    onClick={handlePhoneUpdate}
                    disabled={updateOrderMutation.isPending}
                  >
                    {updateOrderMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Save'
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handlePhoneEditCancel}
                    disabled={updateOrderMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
                {phoneError && (
                  <p className="text-sm text-red-500">{phoneError}</p>
                )}
              </div>
            ) : (
              <p 
                className="text-sm cursor-pointer hover:text-blue-600 transition-colors"
                onClick={handlePhoneEditStart}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handlePhoneEditStart();
                  }
                }}
              >
                {order.customer_phone || "Click to add phone number"}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <Label className="text-sm font-medium">Payment Status</Label>
              <Badge 
                variant="secondary" 
                className={`ml-2 ${
                  order.payment_status === 'paid' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {order.payment_status?.toUpperCase() || 'PENDING'}
              </Badge>
            </div>
            {order.payment_reference && (
              <div className="text-right">
                <Label className="text-sm font-medium">Payment Reference</Label>
                <p className="text-sm font-mono break-all">{order.payment_reference}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Order Items ({items?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items?.map((item, index) => (
              <div key={item.id || index} className="flex items-center gap-4 p-4 border rounded-lg">
                {item.product?.image_url && (
                  <img 
                    src={item.product.image_url} 
                    alt={item.product.name || 'Product'}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{item.product?.name || 'Product'}</h4>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity || 0} × {formatCurrency(item.unit_price || 0)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-medium">{formatCurrency(item.total_price || 0)}</p>
                </div>
              </div>
            ))}
            
            {orderSummary && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(orderSummary.subtotal)}</span>
                  </div>
                  
                  {order.order_type === 'delivery' && orderSummary.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>Delivery Fee:</span>
                      <span>{formatCurrency(orderSummary.deliveryFee)}</span>
                    </div>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>{formatCurrency(orderSummary.total)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Information */}
      {order.order_type === 'delivery' && fulfillment_info && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Delivery Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Delivery Window
              </Label>
              <p className="text-sm">
                {fulfillment_info.delivery_date && fulfillment_info.delivery_hours 
                  ? `${fulfillment_info.delivery_date} ${fulfillment_info.delivery_hours.start} - ${fulfillment_info.delivery_hours.end}`
                  : 'To be scheduled'
                }
              </p>
            </div>
            
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Address
              </Label>
              <p className="text-sm break-words">{fulfillment_info.address || 'Address not provided'}</p>
            </div>
            
            {fulfillment_info.special_instructions && (
              <div>
                <Label className="text-sm font-medium">Special Instructions</Label>
                <p className="text-sm break-words">{fulfillment_info.special_instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pickup Information */}
      {order.order_type === 'pickup' && fulfillment_info && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Pickup Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Pickup Point</Label>
              <p className="text-sm">{fulfillment_info.pickup_point_name || 'Main Location'}</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pickup Window
              </Label>
              <p className="text-sm">
                {fulfillment_info.pickup_time || 'To be scheduled'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Update Status</Label>
            <Select onValueChange={handleStatusChange} disabled={isUpdating}>
              <SelectTrigger>
                <SelectValue placeholder={isUpdating ? "Updating..." : "Select new status"} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {order.order_type === 'delivery' && (
            <div>
              <Label className="text-sm font-medium">Assign Rider</Label>
              <Select onValueChange={handleRiderAssignment} disabled={ridersLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    ridersLoading ? "Loading riders..." : "Select dispatch rider"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {dispatchRiders?.map((rider) => (
                    <SelectItem key={rider.id} value={rider.id}>
                      {rider.name} - {rider.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!dispatchRiders?.length && !ridersLoading && (
                <p className="text-sm text-muted-foreground mt-1">No riders available</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Last Updated: {order.updated_at ? new Date(order.updated_at).toLocaleString() : 'Unknown'}</p>
            {order.updated_by && <p>Updated by: {order.updated_by}</p>}
            <p>Order ID: {order.id}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

OrderDetailsSingleColumn.displayName = 'OrderDetailsSingleColumn';

export default OrderDetailsSingleColumn;
