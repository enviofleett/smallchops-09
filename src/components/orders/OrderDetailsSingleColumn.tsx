import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useDetailedOrderData } from "@/hooks/useDetailedOrderData";
import { useUpdateOrderStatus } from "@/hooks/useUpdateOrderStatus";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrder } from "@/api/orders";
import { getDispatchRiders } from "@/api/users";
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
  AlertCircle 
} from "lucide-react";
import { OrderStatus, OrderType } from "@/types/orderDetailsModal";

interface OrderDetailsSingleColumnProps {
  orderId: string;
  adminEmail?: string;
}

const statusColors = {
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
};

const statusOptions: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 
  'delivered', 'cancelled', 'refunded', 'completed', 'returned'
];

export default function OrderDetailsSingleColumn({ orderId, adminEmail }: OrderDetailsSingleColumnProps) {
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  
  const queryClient = useQueryClient();
  const { data: orderData, isLoading, error, refetch } = useDetailedOrderData(orderId);
  const { updateStatus, isUpdating } = useUpdateOrderStatus(orderId);
  
  // Fetch dispatch riders for delivery orders
  const { data: dispatchRiders } = useQuery({
    queryKey: ['dispatch-riders'],
    queryFn: getDispatchRiders,
    enabled: orderData?.order?.order_type === 'delivery'
  });

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: updateOrder,
    onSuccess: (data) => {
      toast.success("Order updated successfully");
      refetch();
      queryClient.invalidateQueries({ queryKey: ['detailed-order', orderId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update order: ${error.message}`);
    }
  });

  // Enhanced status update with email notification
  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      const success = await updateStatus(newStatus);
      if (success && orderData?.order?.customer_email) {
        try {
          await sendOrderStatusEmail({
            to: orderData.order.customer_email,
            orderData: orderData.order,
            status: newStatus,
            adminEmail: adminEmail || 'admin@example.com'
          });
          toast.success("Status updated and email sent!");
        } catch (emailError) {
          console.warn('Email sending failed:', emailError);
          toast.warning("Status updated but email failed to send");
        }
      }
      // Refresh data after successful update
      refetch();
    } catch (error) {
      console.error('Status update failed:', error);
      toast.error("Failed to update status");
    }
  };

  // Enhanced rider assignment
  const handleRiderAssignment = (riderId: string) => {
    if (riderId === "no-riders") return;
    
    updateOrderMutation.mutate(
      {
        orderId,
        updates: { assigned_rider_id: riderId }
      },
      {
        onSuccess: () => {
          const rider = dispatchRiders?.find(r => r.id === riderId);
          toast.success(`Rider ${rider?.name} assigned successfully`);
        },
        onError: (error: any) => {
          toast.error(`Failed to assign rider: ${error.message}`);
        }
      }
    );
  };

  // Enhanced phone update
  const handlePhoneUpdate = () => {
    if (newPhone.trim()) {
      updateOrderMutation.mutate(
        {
          orderId,
          updates: { customer_phone: newPhone }
        },
        {
          onSuccess: () => {
            setEditingPhone(false);
            setNewPhone("");
            toast.success("Phone number updated successfully");
          },
          onError: (error: any) => {
            toast.error(`Failed to update phone: ${error.message}`);
          }
        }
      );
    } else {
      toast.error("Please enter a valid phone number");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading order details...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Error Loading Order</h3>
          <p className="text-red-600 mb-4">
            {error instanceof Error ? error.message : 'Failed to load order details'}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }
  
  if (!orderData?.order) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">Order Not Found</h3>
          <p className="text-muted-foreground">
            The order you're looking for doesn't exist or may have been removed.
          </p>
        </div>
      </div>
    );
  }

  const { order, items, fulfillment_info } = orderData;
  const deliveryFee = order.delivery_fee || 0;
  const subtotal = items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">#{order.order_number}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={`${statusColors[order.status]} text-white`}>
                  {order.status.toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {order.order_type.toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  CONNECTED
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Name</Label>
              <p className="text-sm">{order.customer_name}</p>
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
            <p className="text-sm">{order.customer_email}</p>
          </div>

          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone
            </Label>
            {editingPhone ? (
              <div className="flex gap-2 mt-1">
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="flex-1"
                />
                <Button size="sm" onClick={handlePhoneUpdate}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingPhone(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <p 
                className="text-sm cursor-pointer hover:text-blue-600"
                onClick={() => {
                  setNewPhone(order.customer_phone || "");
                  setEditingPhone(true);
                }}
              >
                {order.customer_phone || "Click to add phone"}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Payment Status</Label>
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                {order.payment_status.toUpperCase()}
              </Badge>
            </div>
            <div className="text-right">
              <Label className="text-sm font-medium">Payment Reference</Label>
              <p className="text-sm font-mono">{order.payment_reference}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Order Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items?.map((item, index) => (
              <div key={item.id || index} className="flex items-center gap-4 p-4 border rounded-lg">
                {item.product?.image_url && (
                  <img 
                    src={item.product.image_url} 
                    alt={item.product.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-medium">{item.product?.name || 'Product'}</h4>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity} × ₦{item.unit_price?.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">₦{item.total_price?.toLocaleString()}</p>
                </div>
              </div>
            )) || (
              <div className="text-center py-4 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No items found</p>
              </div>
            )}
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₦{subtotal.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>₦{order.total_amount?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Fee (for delivery orders only) */}
      {order.order_type === 'delivery' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Delivery Fee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Delivery Fee:</span>
              <span className="text-lg font-bold">₦{deliveryFee.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Information (for delivery orders) */}
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
              <p className="text-sm">{fulfillment_info.address}</p>
            </div>
            
            {fulfillment_info.special_instructions && (
              <div>
                <Label className="text-sm font-medium">Special Instructions</Label>
                <p className="text-sm">{fulfillment_info.special_instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pickup Information (for pickup orders) */}
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

      {/* Admin Status Change */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Actions (Admin Only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Current Status</Label>
            <div className="mt-1 mb-3">
              <Badge className={`${statusColors[order.status]} text-white`}>
                {order.status.toUpperCase()}
              </Badge>
            </div>
            <Label className="text-sm font-medium">Update Status</Label>
            <Select onValueChange={handleStatusChange} disabled={isUpdating}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.filter(status => status !== order.status).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isUpdating && (
              <p className="text-sm text-muted-foreground mt-2">Updating status...</p>
            )}
          </div>

          {order.order_type === 'delivery' && (
            <div>
              <Label className="text-sm font-medium">
                Assign Rider
                {order.assigned_rider_id && (
                  <span className="ml-2 text-xs text-green-600">
                    (Currently assigned)
                  </span>
                )}
              </Label>
              <Select onValueChange={handleRiderAssignment} disabled={updateOrderMutation.isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dispatch rider" />
                </SelectTrigger>
                <SelectContent>
                  {dispatchRiders?.map((rider) => (
                    <SelectItem key={rider.id} value={rider.id}>
                      {rider.name} - {rider.phone}
                    </SelectItem>
                  )) || (
                    <SelectItem value="no-riders" disabled>
                      No riders available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {updateOrderMutation.isPending && (
                <p className="text-sm text-muted-foreground mt-2">Assigning rider...</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Update */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>Last Updated: {order.updated_at ? new Date(order.updated_at).toLocaleString() : 'Not available'}</span>
            </div>
            {order.updated_by && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Updated by: {adminEmail || 'Admin Officer'}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}