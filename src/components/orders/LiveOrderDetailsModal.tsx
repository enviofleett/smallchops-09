import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRealTimeOrderData } from "@/hooks/useRealTimeOrderData";
import { useDriverManagement } from "@/hooks/useDriverManagement";
import { useProductionStatusUpdate } from "@/hooks/useProductionStatusUpdate";
import { EmailOperations } from "@/utils/emailOperations";
import { EnhancedFinancialBreakdown } from "./details/EnhancedFinancialBreakdown";
import { CompleteFulfillmentSection } from "./details/CompleteFulfillmentSection";
import { EnhancedDriverSection } from "./details/EnhancedDriverSection";
import { CompleteOrderItemsSection } from "./details/CompleteOrderItemsSection";
import { RefreshCw } from "lucide-react";

export default function LiveOrderDetailsModal({ orderId, open, onClose, isAdmin }) {
  // Fetch comprehensive real-time order data
  const {
    data: orderData,
    isLoading,
    error,
    lastUpdated,
    connectionStatus,
    reconnect
  } = useRealTimeOrderData(orderId);

  // Extract data from comprehensive response
  const order = orderData?.order;
  const items = orderData?.items || [];
  const fulfillmentInfo = orderData?.fulfillment_info;
  const deliverySchedule = orderData?.delivery_schedule;
  const pickupPoint = orderData?.pickup_point;
  const assignedAgent = orderData?.assigned_agent;

  // Admin-only hooks
  const { drivers = [] } = useDriverManagement();
  const { updateStatus } = useProductionStatusUpdate();

  const [assigningDriver, setAssigningDriver] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Debug logs
  useEffect(() => {
    console.log("ORDER DATA:", order);
    console.log("DRIVERS:", drivers);
  }, [order, drivers]);

  // Handler for assigning driver
  const handleAssignDriver = async (driverId) => {
    if (!order || !driverId) return;
    setAssigningDriver(true);
    try {
      // Find driver name
      const driver = drivers.find(d => d.id === driverId);
      await EmailOperations.queueTransactionalEmail({
        recipient_email: order.customer_email,
        template_key: "rider_assigned",
        variables: {
          customer_name: order.customer_name,
          order_number: order.order_number,
          driver_name: driver?.name || "Driver"
        }
      });
      // Use reconnect to refresh real-time data
      reconnect();
    } catch (e) {
      alert("Failed to assign driver.");
      console.error(e);
    }
    setAssigningDriver(false);
  };

  // Handler for status change
  const handleChangeStatus = async (e) => {
    const status = e.target.value;
    if (!order || !status) return;
    setUpdatingStatus(true);
    try {
      await updateStatus({ orderId: order.id, status });
      await EmailOperations.queueTransactionalEmail({
        recipient_email: order.customer_email,
        template_key: `order_${status}`,
        variables: {
          customer_name: order.customer_name,
          order_number: order.order_number,
          status: status.replace(/_/g, " ")
        }
      });
      // Use reconnect to refresh real-time data
      reconnect();
    } catch (e) {
      alert("Failed to update status.");
      console.error(e);
    }
    setUpdatingStatus(false);
  };

  if (isLoading) return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full md:max-w-4xl">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-primary mr-2" />
          Loading order details...
        </div>
      </DialogContent>
    </Dialog>
  );

  if (error || !order) return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full md:max-w-4xl">
        <div className="text-center py-8 text-destructive">
          {error?.message || 'Error loading order details'}
        </div>
      </DialogContent>
    </Dialog>
  );

  const hasDrivers = Array.isArray(drivers) && drivers.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full md:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  Order #{order.order_number}
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    order.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {order.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground font-normal">
                  {order.order_type?.replace(/_/g, ' ')} • Created {new Date(order.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Connection Status */}
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                {connectionStatus}
              </div>
              
              {/* Last Updated */}
              {lastUpdated && (
                <div className="text-xs text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Customer Information */}
            <section className="space-y-3">
              <h3 className="font-semibold text-base text-foreground">Customer Information</h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium text-foreground">{order.customer_name || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground">{order.customer_email || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium text-foreground">{order.customer_phone || '-'}</span>
                </div>
              </div>
            </section>

            {/* Payment Details */}
            <section className="space-y-3">
              <h3 className="font-semibold text-base text-foreground">Payment Details</h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`font-medium ${
                    order.payment_status === 'paid' ? 'text-green-600' :
                    order.payment_status === 'failed' ? 'text-red-600' :
                    'text-amber-600'
                  }`}>
                    {order.payment_status || '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-medium text-foreground">{order.payment_method || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-medium text-foreground font-mono text-xs">
                    {order.payment_reference || '-'}
                  </span>
                </div>
              </div>
            </section>

            {/* Enhanced Financial Breakdown */}
            <EnhancedFinancialBreakdown order={order} />

            {/* Complete Fulfillment Section */}
            <CompleteFulfillmentSection 
              order={order}
              fulfillmentInfo={fulfillmentInfo}
              deliverySchedule={deliverySchedule}
              pickupPoint={pickupPoint}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Enhanced Driver Section */}
            <EnhancedDriverSection
              order={order}
              assignedAgent={assignedAgent}
              drivers={drivers}
              isAdmin={isAdmin}
              onAssignDriver={handleAssignDriver}
              assigningDriver={assigningDriver}
            />

            {/* Complete Order Items Section */}
            <CompleteOrderItemsSection items={items} />

            {/* Admin Actions */}
            {isAdmin && (
              <section className="space-y-3">
                <h3 className="font-semibold text-base text-foreground">Admin Actions</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-2">
                      Update Order Status
                    </label>
                    <select 
                      value={order.status} 
                      onChange={handleChangeStatus} 
                      disabled={updatingStatus}
                      className="w-full p-2 border rounded-md bg-background"
                    >
                      {"pending,confirmed,preparing,ready,out_for_delivery,delivered,cancelled,refunded,completed,returned"
                        .split(",")
                        .map(status => (
                          <option key={status} value={status}>
                            {status.replace(/_/g, " ")}
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={reconnect}
                    disabled={assigningDriver || updatingStatus}
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Data
                  </Button>
                </div>
              </section>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}