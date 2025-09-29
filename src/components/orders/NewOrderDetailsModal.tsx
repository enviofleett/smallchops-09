import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { ThermalPrintReceipt } from './ThermalPrintReceipt';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import '@/styles/thermal-print.css';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package,
  User,
  MapPin,
  Clock,
  Phone,
  Mail,
  Truck,
  CheckCircle,
  Printer,
  AlertCircle,
  Settings,
  Loader2
} from 'lucide-react';
import { useUserContext } from '@/hooks/useUserContext';
import { useRealTimeOrderData } from '@/hooks/useRealTimeOrderData';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { useProductionStatusUpdate } from '@/hooks/useProductionStatusUpdate';
import { RealTimeConnectionStatus } from '@/components/common/RealTimeConnectionStatus';
import { triggerOrderUpdate } from '@/components/notifications/NotificationIntegration';
import { supabase } from '@/integrations/supabase/client';

interface NewOrderDetailsModalProps {
  open: boolean;
  onClose: () => void;
  order?: any; // Real order data - required for live data
}

// Status color mapping
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

// Driver assignment dialog component (for admin use)
const DriverAssignmentSection: React.FC<{
  orderId: string;
  currentDriverId?: string | null;
  onDriverAssigned: () => void;
}> = ({ orderId, currentDriverId, onDriverAssigned }) => {
  const { drivers, loading: driversLoading } = useDriverManagement();
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  const activeDrivers = drivers.filter(driver => driver.is_active);

  const handleAssignDriver = async () => {
    if (!selectedDriverId || isAssigning) return;

    setIsAssigning(true);
    try {
      const { error } = await supabase.rpc('assign_rider_to_order', {
        p_order_id: orderId,
        p_rider_id: selectedDriverId
      });

      if (error) throw error;

      const driver = drivers.find(d => d.id === selectedDriverId);
      toast.success(`Driver ${driver?.name} assigned successfully`);
      
      // Trigger notification for driver assignment
      triggerOrderUpdate(orderId, 'driver_assigned', `Driver ${driver?.name} has been assigned to this order`);
      
      onDriverAssigned();
    } catch (error) {
      console.error('Driver assignment failed:', error);
      toast.error('Failed to assign driver');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignDriver = async () => {
    if (isAssigning) return;

    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ assigned_rider_id: null })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Driver unassigned successfully');
      triggerOrderUpdate(orderId, 'driver_unassigned', 'Driver has been unassigned from this order');
      onDriverAssigned();
    } catch (error) {
      console.error('Driver unassignment failed:', error);
      toast.error('Failed to unassign driver');
    } finally {
      setIsAssigning(false);
    }
  };

  if (driversLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading drivers...
      </div>
    );
  }

  const currentDriver = drivers.find(d => d.id === currentDriverId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Driver Assignment</h4>
        {currentDriver && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnassignDriver}
            disabled={isAssigning}
          >
            {isAssigning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Unassign'
            )}
          </Button>
        )}
      </div>

      {currentDriver ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-800">{currentDriver.name}</span>
          </div>
          <p className="text-sm text-green-600 mt-1">{currentDriver.phone}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <select
            className="w-full p-2 border rounded-md"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            disabled={isAssigning || activeDrivers.length === 0}
          >
            <option value="">Select a driver...</option>
            {activeDrivers.map(driver => (
              <option key={driver.id} value={driver.id}>
                {driver.name} - {driver.phone}
              </option>
            ))}
          </select>
          
          {activeDrivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active drivers available</p>
          ) : (
            <Button
              onClick={handleAssignDriver}
              disabled={!selectedDriverId || isAssigning}
              size="sm"
              className="w-full"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Driver'
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Status update section (for admin use)
const AdminStatusUpdateSection: React.FC<{
  orderId: string;
  currentStatus: string;
  orderNumber: string;
  onStatusUpdated: () => void;
}> = ({ orderId, currentStatus, orderNumber, onStatusUpdated }) => {
  const { updateStatus, isUpdating } = useProductionStatusUpdate();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Out for Delivery' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const handleStatusUpdate = async () => {
    if (selectedStatus === currentStatus || isUpdating) return;

    try {
      await updateStatus({ orderId, status: selectedStatus });
      
      // Trigger notification with Gmail integration
      triggerOrderUpdate(orderNumber, selectedStatus, `Order status updated to ${selectedStatus.replace('_', ' ')}`);
      
      onStatusUpdated();
    } catch (error) {
      console.error('Status update failed:', error);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium">Update Order Status</h4>
      
      <div className="space-y-2">
        <select
          className="w-full p-2 border rounded-md"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          disabled={isUpdating}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <Button
          onClick={handleStatusUpdate}
          disabled={selectedStatus === currentStatus || isUpdating}
          size="sm"
          className="w-full"
        >
          {isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            'Update Status'
          )}
        </Button>
      </div>
    </div>
  );
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0
  }).format(amount);
};

export const NewOrderDetailsModal: React.FC<NewOrderDetailsModalProps> = ({
  open,
  onClose,
  order // Real order data is now required
}) => {
  const userContext = useUserContext();
  const printRef = useRef<HTMLDivElement>(null);
  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { data: businessSettings } = useBusinessSettings();

  // Fetch real-time order data
  const { 
    data: detailedOrderData, 
    isLoading: isLoadingDetailed, 
    error, 
    lastUpdated, 
    connectionStatus, 
    reconnect 
  } = useRealTimeOrderData(order?.id);

  const handlePrint = useReactToPrint({
    contentRef: thermalPrintRef,
    documentTitle: `Order-${order?.order_number || 'Details'}`,
    pageStyle: `
      @page {
        size: 80mm auto;
        margin: 2mm;
        padding: 0;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
          background: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: 'Courier New', monospace !important;
        }
        .thermal-receipt {
          display: block !important;
          position: relative !important;
          left: auto !important;
          top: auto !important;
          width: 76mm !important;
          max-width: 76mm !important;
          background: white !important;
          color: black !important;
          font-family: 'Courier New', monospace !important;
          font-size: 8px !important;
          line-height: 1.2 !important;
          margin: 0 !important;
          padding: 2mm !important;
          page-break-after: avoid;
          page-break-inside: avoid;
          overflow: visible;
          min-height: auto;
        }
      }
    `,
    onBeforePrint: () => {
      // Show the thermal receipt temporarily for printing
      if (thermalPrintRef.current) {
        thermalPrintRef.current.style.display = 'block';
        thermalPrintRef.current.style.position = 'relative';
        thermalPrintRef.current.style.left = 'auto';
        thermalPrintRef.current.style.top = 'auto';
      }
      return Promise.resolve();
    },
    onAfterPrint: () => {
      // Hide the thermal receipt again after printing
      if (thermalPrintRef.current) {
        thermalPrintRef.current.style.display = 'none';
        thermalPrintRef.current.style.position = 'absolute';
        thermalPrintRef.current.style.left = '-9999px';
        thermalPrintRef.current.style.top = '0';
      }
      toast.success('Thermal receipt printed successfully');
    },
    onPrintError: () => toast.error('Failed to print thermal receipt')
  });

  const handleRefresh = () => {
    reconnect();
    setRefreshTrigger(prev => prev + 1);
  };

  // Show error state if no order provided
  if (!order) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="sm"
        title="Order Not Found"
        description="Order details are not available"
      >
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No order data provided.</p>
          <Button onClick={onClose} className="mt-4">Close</Button>
        </div>
      </AdaptiveDialog>
    );
  }

  // Use detailed order data if available, otherwise fall back to basic order data
  const orderData = detailedOrderData?.order || order;
  const orderItems = detailedOrderData?.items || order.order_items || order.items || [];
  const fulfillmentInfo = detailedOrderData?.fulfillment_info || order.fulfillment_info || {};

  // Show loading state
  if (isLoadingDetailed && !orderData) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="lg"
        title="Loading Order Details..."
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading order details...</span>
        </div>
      </AdaptiveDialog>
    );
  }

  const isAdmin = userContext === 'admin';
  const isCustomer = userContext === 'customer';

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onClose}
      size="xl"
      title={`Order #${orderData.order_number}`}
      description={isAdmin ? "Admin View - Full Order Management" : "Order Details"}
      className="max-w-6xl"
    >
      <div className="max-w-5xl mx-auto space-y-6" ref={printRef}>
        {/* Real-time connection status (admin only) */}
        {isAdmin && (
          <RealTimeConnectionStatus
            connectionStatus={connectionStatus}
            lastUpdated={lastUpdated}
            onReconnect={reconnect}
            compact={true}
            className="mb-4"
          />
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load complete order details. Some information may be outdated.
              <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`${STATUS_COLORS[orderData.status as keyof typeof STATUS_COLORS]} text-white text-base px-4 py-2`}>
                  {orderData.status?.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {orderData.order_type?.toUpperCase() || 'DELIVERY'}
                </Badge>
                {!isLoadingDetailed && detailedOrderData && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    LIVE DATA
                  </Badge>
                )}
                {isAdmin && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                    ADMIN VIEW
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print Receipt
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    // Show preview of thermal receipt for debugging
                    if (thermalPrintRef.current) {
                      const receiptContent = thermalPrintRef.current.innerHTML;
                      const previewWindow = window.open('', '_blank', 'width=400,height=600');
                      if (previewWindow) {
                        previewWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>Receipt Preview</title>
                              <style>
                                body { 
                                  font-family: 'Courier New', monospace; 
                                  font-size: 8px; 
                                  line-height: 1.2; 
                                  max-width: 76mm; 
                                  margin: 0 auto; 
                                  padding: 2mm;
                                  background: white;
                                  color: black;
                                }
                                .business-name { font-weight: 900; font-size: 11px; text-align: center; text-transform: uppercase; margin-bottom: 2px; }
                                .contact { font-size: 8px; text-align: center; margin-bottom: 1px; }
                                .section-header { font-weight: 900; font-size: 9px; margin-bottom: 1px; text-transform: uppercase; }
                                .divider { text-align: center; font-size: 8px; margin: 1px 0; }
                                .item-header { display: flex; justify-content: space-between; font-size: 8px; }
                                .item-total { font-weight: 900; }
                                .item-meta { font-size: 7px; margin-bottom: 0; }
                                .item-detail { font-size: 7px; margin-left: 2px; margin-bottom: 0; }
                                .summary-line { display: flex; justify-content: space-between; font-size: 8px; margin-bottom: 0; }
                                .total-line { display: flex; justify-content: space-between; font-weight: 900; font-size: 10px; border-top: 2px solid black; padding-top: 2px; margin-top: 2px; }
                                .text-center { text-align: center; }
                                .order-info, .customer-info, .delivery-schedule, .payment-info, .special-instructions { margin-bottom: 2px; font-size: 8px; }
                                .items-section { margin-bottom: 2px; }
                                .item-block { margin-bottom: 1px; }
                                .order-summary { margin-bottom: 2px; }
                                .footer { text-align: center; font-size: 7px; }
                                .admin-print-info { font-size: 8px; margin-top: 4px; text-align: center; font-weight: 900; text-transform: uppercase; }
                              </style>
                            </head>
                            <body>
                              ${receiptContent}
                            </body>
                          </html>
                        `);
                        previewWindow.document.close();
                      }
                    }
                  }}
                  className="text-xs"
                >
                  Preview
                </Button>
              </div>
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
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-sm">{orderData.customer_name || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="text-sm">{orderData.customer_type || 'Guest Customer'}</p>
              </div>
            </div>
            
            {orderData.customer_email && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </p>
                <p className="text-sm break-all">{orderData.customer_email}</p>
              </div>
            )}

            {orderData.customer_phone && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </p>
                <p className="text-sm">{orderData.customer_phone}</p>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                <Badge 
                  variant="secondary" 
                  className={`ml-2 ${
                    orderData.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 
                    orderData.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}
                >
                  {orderData.payment_status?.toUpperCase() || 'UNKNOWN'}
                </Badge>
              </div>
              {orderData.payment_reference && (
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">Payment Reference</p>
                  <p className="text-sm font-mono break-all">{orderData.payment_reference}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin Actions (Admin Only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Admin Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <AdminStatusUpdateSection
                orderId={orderData.id}
                currentStatus={orderData.status}
                orderNumber={orderData.order_number}
                onStatusUpdated={handleRefresh}
              />
              
              <Separator />
              
              <DriverAssignmentSection
                orderId={orderData.id}
                currentDriverId={orderData.assigned_rider_id}
                onDriverAssigned={handleRefresh}
              />
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Items ({orderItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orderItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items found for this order</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orderItems.map((item: any, index: number) => (
                  <div key={item.id || index} className="flex items-start gap-4 p-4 border rounded-lg bg-card">
                    {item.product?.image_url && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img 
                          src={item.product.image_url} 
                          alt={item.product.name || 'Product'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-foreground leading-tight">
                          {item.product?.name || item.name || 'Product'}
                        </h4>
                        <span className="font-semibold text-foreground whitespace-nowrap">
                          ₦{(item.total_price || 0).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Qty: {item.quantity || 1}</span>
                        <span>×</span>
                        <span>₦{(item.unit_price || 0).toLocaleString()}</span>
                      </div>

                      {item.special_instructions && (
                        <div className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
                          <span className="font-medium">Note:</span> {item.special_instructions}
                        </div>
                      )}

                      {item.customizations && (
                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          <span className="font-medium">Customizations:</span> {item.customizations}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Order Summary */}
                <div className="border-t pt-4 mt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">
                        ₦{orderItems.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0).toLocaleString()}
                      </span>
                    </div>
                    
                    {orderData.vat_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT ({orderData.vat_rate || 7.5}%)</span>
                        <span className="font-medium">₦{orderData.vat_amount.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {orderData.delivery_fee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delivery Fee</span>
                        <span className="font-medium">₦{orderData.delivery_fee.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {orderData.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium text-success">-₦{orderData.discount_amount.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span>₦{orderData.total_amount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Information */}
        {orderData.order_type === 'delivery' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Delivery Window
                </p>
                <p className="text-sm">
                  {fulfillmentInfo.delivery_date && fulfillmentInfo.delivery_hours 
                    ? `${fulfillmentInfo.delivery_date} ${fulfillmentInfo.delivery_hours.start} - ${fulfillmentInfo.delivery_hours.end}`
                    : detailedOrderData?.delivery_schedule?.delivery_date
                    ? `${detailedOrderData.delivery_schedule.delivery_date} ${detailedOrderData.delivery_schedule.delivery_time_start} - ${detailedOrderData.delivery_schedule.delivery_time_end}`
                    : 'To be scheduled'
                  }
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address
                </p>
                <p className="text-sm break-words">
                  {fulfillmentInfo.address || orderData.delivery_address || 'No address provided'}
                </p>
              </div>
              
              {(fulfillmentInfo.special_instructions || orderData.special_instructions || detailedOrderData?.delivery_schedule?.special_instructions) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Special Instructions</p>
                  <p className="text-sm break-words">
                    {fulfillmentInfo.special_instructions || orderData.special_instructions || detailedOrderData?.delivery_schedule?.special_instructions}
                  </p>
                </div>
              )}

              {isAdmin && orderData.assigned_rider_id && detailedOrderData?.items && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">Driver Assignment</p>
                  <p className="text-sm text-blue-600">
                    A driver has been assigned to this delivery order.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Order Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detailedOrderData?.timeline && detailedOrderData.timeline.length > 0 ? (
              <div className="space-y-3">
                {detailedOrderData.timeline.map((step: any, index: number) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      step.status === 'completed' ? 'bg-green-500' :
                      step.status === 'current' ? 'bg-blue-500' :
                      'bg-gray-300'
                    }`}></div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        step.status === 'pending' ? 'text-muted-foreground' : ''
                      }`}>
                        {step.label || step.step}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.datetime ? new Date(step.datetime).toLocaleString() : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Fallback timeline based on current status
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Order Placed</p>
                    <p className="text-xs text-muted-foreground">
                      {orderData.created_at ? new Date(orderData.created_at).toLocaleString() : 'Date not available'}
                    </p>
                  </div>
                </div>
                
                {['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed'].includes(orderData.status) && (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Order Confirmed</p>
                      <p className="text-xs text-muted-foreground">
                        {orderData.updated_at ? new Date(orderData.updated_at).toLocaleString() : 'Recently'}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    orderData.status === 'preparing' ? 'bg-orange-500' :
                    ['ready', 'out_for_delivery', 'delivered', 'completed'].includes(orderData.status) ? 'bg-green-500' :
                    'bg-gray-300'
                  }`}></div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      !['preparing', 'ready', 'out_for_delivery', 'delivered', 'completed'].includes(orderData.status) ? 'text-muted-foreground' : ''
                    }`}>
                      {orderData.status === 'preparing' ? 'Currently Preparing' : 'Preparing'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {orderData.status === 'preparing' ? 'In progress' : 'Pending'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    ['delivered', 'completed'].includes(orderData.status) ? 'bg-green-500' :
                    'bg-gray-300'
                  }`}></div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      !['delivered', 'completed'].includes(orderData.status) ? 'text-muted-foreground' : ''
                    }`}>
                      {orderData.order_type === 'delivery' ? 'Delivered' : 'Ready for Pickup'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {['delivered', 'completed'].includes(orderData.status) ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Communication Events (Admin Only) */}
        {isAdmin && detailedOrderData?.communication_events && detailedOrderData.communication_events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Communication History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {detailedOrderData.communication_events.map((event: any, index: number) => (
                  <div key={event.id || index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {event.event_type || 'Email'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {event.created_at ? new Date(event.created_at).toLocaleString() : 'Recently'}
                      </span>
                    </div>
                    <p className="text-sm">{event.message || event.subject || 'Communication sent'}</p>
                    {event.status && (
                      <Badge 
                        variant="secondary" 
                        className={`mt-2 text-xs ${
                          event.status === 'sent' ? 'bg-green-100 text-green-800' :
                          event.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                          event.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {event.status.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardContent className="pt-6">
             <div className="text-sm text-muted-foreground space-y-1">
               <p>Created: {orderData.created_at ? new Date(orderData.created_at).toLocaleString() : 'Not available'}</p>
               <p>Last Updated: {orderData.updated_at ? new Date(orderData.updated_at).toLocaleString() : orderData.created_at ? new Date(orderData.created_at).toLocaleString() : 'Not available'}</p>
               <p>Order ID: {orderData.id}</p>
               {isAdmin && connectionStatus === 'connected' && (
                 <p className="text-green-600">🟢 Real-time updates active</p>
               )}
             </div>
           </CardContent>
         </Card>

         {/* Hidden Thermal Receipt for Printing */}
         <div ref={thermalPrintRef} style={{ position: 'absolute', left: '-9999px', top: '0', background: 'white', padding: '2mm' }}>
           <ThermalPrintReceipt
             order={{
               ...orderData,
               order_items: orderItems,
               fulfillment_info: fulfillmentInfo
             }}
             deliverySchedule={fulfillmentInfo}
             businessInfo={businessSettings ? {
               name: businessSettings.name || 'Starter Small Chops',
               whatsapp_support_number: businessSettings.whatsapp_support_number || '0807 301 1100',
               admin_notification_email: 'store@startersmallchops.com',
               logo_url: businessSettings.logo_url
             } : {
               name: 'Starter Small Chops',
               whatsapp_support_number: '0807 301 1100',
               admin_notification_email: 'store@startersmallchops.com'
             }}
           />
         </div>
       </div>
     </AdaptiveDialog>
   );
 };