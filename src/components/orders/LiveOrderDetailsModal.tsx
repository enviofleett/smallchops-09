import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useRealTimeOrderData } from "@/hooks/useRealTimeOrderData";
import { useDriverManagement } from "@/hooks/useDriverManagement";
import { useProductionStatusUpdate } from "@/hooks/useProductionStatusUpdate";
import { useErrorRecovery } from "@/hooks/useErrorRecovery";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { EmailOperations } from "@/utils/emailOperations";
import { errorReporting } from "@/lib/errorReporting";
import { EnhancedFinancialBreakdown } from "./details/EnhancedFinancialBreakdown";
import { CompleteFulfillmentSection } from "./details/CompleteFulfillmentSection";
import { EnhancedDriverSection } from "./details/EnhancedDriverSection";
import { CompleteOrderItemsSection } from "./details/CompleteOrderItemsSection";
import { OrderDetailsSectionErrorBoundary } from "./details/ErrorBoundary";
import { RefreshCw, AlertTriangle, Shield, Info } from "lucide-react";

// 🔒 SECURITY: Remove isAdmin prop - use server-backed auth only
export default function LiveOrderDetailsModal({ orderId, open, onClose }) {
  // 🔒 SECURITY: Server-backed admin verification (never trust props)
  const { isAdmin, isLoading: authLoading } = useUnifiedAuth();
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

  // Error recovery hook
  const { retry, canRetry, isRetrying } = useErrorRecovery({
    maxRetries: 3,
    retryDelay: 2000,
    onMaxRetriesExceeded: (error) => {
      errorReporting.reportError(
        errorReporting.createErrorReport(error, 'OrderDetailsModal')
      );
    }
  });

  const [assigningDriver, setAssigningDriver] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Debug logs (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("ORDER DATA:", order);
      console.log("DRIVERS:", drivers);
      console.log("CONNECTION STATUS:", connectionStatus);
    }
  }, [order, drivers, connectionStatus]);

  // Enhanced handler for assigning driver with error recovery
  const handleAssignDriver = async (driverId) => {
    if (!order || !driverId) return;
    
    setAssigningDriver(true);
    
    try {
      await retry(async () => {
        // Find driver name with validation
        const driver = Array.isArray(drivers) ? 
          drivers.find(d => d?.id === driverId) : null;
        
        if (!driver) {
          throw new Error('Selected driver not found');
        }

        // Queue email notification
        await EmailOperations.queueTransactionalEmail({
          recipient_email: order.customer_email || '',
          template_key: "rider_assigned",
          variables: {
            customer_name: order.customer_name || 'Customer',
            order_number: order.order_number || orderId,
            driver_name: driver.name || "Driver"
          }
        });

        // Refresh real-time data
        reconnect();
      });
    } catch (e) {
      const errorReport = errorReporting.createErrorReport(
        e instanceof Error ? e : new Error('Driver assignment failed'),
        'AssignDriver'
      );
      errorReporting.reportError(errorReport);
      
      // Show user-friendly error message
      alert(errorReporting.getUserFriendlyMessage('runtime', e as Error));
    } finally {
      setAssigningDriver(false);
    }
  };

  // Enhanced handler for status change with error recovery
  const handleChangeStatus = async (e) => {
    const status = e.target.value;
    if (!order || !status) return;
    
    setUpdatingStatus(true);
    
    try {
      await retry(async () => {
        await updateStatus({ orderId: order.id, status });
        
        // Queue status update email
        await EmailOperations.queueTransactionalEmail({
          recipient_email: order.customer_email || '',
          template_key: `order_${status}`,
          variables: {
            customer_name: order.customer_name || 'Customer',
            order_number: order.order_number || orderId,
            status: status.replace(/_/g, " ")
          }
        });
        
        // Refresh real-time data
        reconnect();
      });
    } catch (e) {
      const errorReport = errorReporting.createErrorReport(
        e instanceof Error ? e : new Error('Status update failed'),
        'UpdateStatus'
      );
      errorReporting.reportError(errorReport);
      
      // Show user-friendly error message
      alert(errorReporting.getUserFriendlyMessage('runtime', e as Error));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Enhanced loading state
  if (isLoading) return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full md:max-w-4xl">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-medium">Loading order details...</p>
            <p className="text-sm text-muted-foreground mt-1">
              {orderId ? `Order #${orderId}` : 'Fetching data'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Enhanced error state with recovery options
  if (error || !order) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg w-full md:max-w-4xl">
          <div className="text-center py-8 space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                Unable to load order details
              </h3>
              <p className="text-sm text-muted-foreground">
                {error?.message || 'Order not found or failed to load'}
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              {canRetry && (
                <Button
                  onClick={() => retry(async () => { reconnect(); })}
                  disabled={isRetrying}
                  className="w-full"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </>
                  )}
                </Button>
              )}
              
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </div>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && error && (
              <Alert className="text-left">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <details className="space-y-2">
                    <summary className="cursor-pointer font-medium">Debug Information</summary>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto whitespace-pre-wrap">
                      {JSON.stringify({ 
                        error: error.message, 
                        orderId, 
                        orderData,
                        connectionStatus 
                      }, null, 2)}
                    </pre>
                  </details>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
            <EnhancedFinancialBreakdown 
              order={order} 
              isLoading={isLoading}
            />

            {/* Complete Fulfillment Section */}
            <CompleteFulfillmentSection 
              order={order}
              fulfillmentInfo={fulfillmentInfo}
              deliverySchedule={deliverySchedule}
              pickupPoint={pickupPoint}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Enhanced Driver Section */}
            <EnhancedDriverSection
              order={order}
              assignedAgent={assignedAgent}
              drivers={drivers}
              onAssignDriver={handleAssignDriver}
              assigningDriver={assigningDriver}
              isLoading={isLoading}
            />

            {/* Complete Order Items Section */}
            <CompleteOrderItemsSection 
              items={items}
              isLoading={isLoading}
            />

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