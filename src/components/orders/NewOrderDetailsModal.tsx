import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRealTimeOrderData } from '@/hooks/useRealTimeOrderData';
import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ThermalPrintReceipt } from './ThermalPrintReceipt';
import { AdminOrderPrintView } from '@/components/admin/AdminOrderPrintView';
import { RealTimeConnectionStatus } from '@/components/common/RealTimeConnectionStatus';
import { 
  Package, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Printer,
  RefreshCw,
  CreditCard,
  FileText,
  DollarSign,
  Calendar,
  Clock,
  AlertCircle,
  AlertTriangle,
  MessageCircle
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { parseProductFeatures } from '@/utils/productFeatureParser';
import { sanitizeText } from '@/utils/htmlSanitizer';
import { DriverAssignmentSection } from './details/DriverAssignmentSection';
import { StatusManagementSection } from './details/StatusManagementSection';
import { useOrderPageHooks } from '@/hooks/orderPageHooks';
import { UnifiedOrder, OrderStatus } from '@/types/unifiedOrder';
import { OrderWithItems } from '@/api/orders';
import { useAuth } from '@/contexts/AuthContext';
import { CustomerOrderStatusTracker } from './CustomerOrderStatusTracker';
import { usePickupPoint } from '@/hooks/usePickupPoints';
import { formatAddress } from '@/utils/formatAddress';
import { getOrderTimeWindow, hasValidTimeField, formatDeliveryDate } from '@/utils/timeWindowUtils';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useDeliveryZones } from '@/hooks/useDeliveryZones';
import { toast } from 'sonner';
import '@/styles/admin-print.css';
import '@/styles/admin-80mm-print.css';

interface NewOrderDetailsModalProps {
  open: boolean;
  onClose: () => void;
  order: any | null;
}

export function NewOrderDetailsModal({ open, onClose, order }: NewOrderDetailsModalProps) {
  // CRITICAL: Early null guard to prevent errors during modal transitions
  if (!order) {
    return null;
  }

  const { userType, user } = useAuth();
  const isAdmin = userType === 'admin';
  
  const adminPrintRef = useRef<HTMLDivElement>(null);
  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const { data, isLoading, error, lastUpdated, connectionStatus, reconnect } = useRealTimeOrderData(
    order?.id
  );

  const { assignRiderMutation, handleStatusUpdate } = useOrderPageHooks(order.id);

  // Enhanced status update that closes modal immediately for confirmed tab
  const handleStatusUpdateWithClose = async (newStatus: OrderStatus) => {
    const success = await handleStatusUpdate(newStatus);
    if (success && order.status === 'confirmed' && newStatus !== 'confirmed') {
      // Close modal immediately when moving from confirmed to another status
      setTimeout(() => {
        onClose();
      }, 500); // Small delay to show success toast
    }
    return success;
  };

  // Fetch pickup point data if order is pickup type
  const { data: pickupPoint, isLoading: isLoadingPickupPoint } = usePickupPoint(
    order?.pickup_point_id
  );

  // Fetch business settings for print header
  const { data: businessSettings } = useBusinessSettings();
  
  // Fetch delivery zones to display zone name
  const { zones } = useDeliveryZones();
  const deliveryZone = zones.find(zone => zone.id === order?.delivery_zone_id);

  // Enhanced print handler for admin with success/error notifications
  const handlePrint = useReactToPrint({
    contentRef: isAdmin ? adminPrintRef : thermalPrintRef,
    documentTitle: `Order-${order?.order_number || 'Receipt'}`,
    onAfterPrint: () => {
      toast.success('Order printed successfully', {
        description: `Order #${order?.order_number} has been sent to printer`,
      });
    },
    onPrintError: (error) => {
      console.error('Print error:', error);
      toast.error('Failed to print order', {
        description: 'Please check your printer connection and try again',
      });
    },
  });

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    reconnect();
  };

  const handleAssignDriver = async (driverId: string) => {
    await assignRiderMutation.mutateAsync({
      orderId: order.id,
      riderId: driverId
    });
  };

  if (isLoading && !data) {
    return (
      <AdaptiveDialog open={open} onOpenChange={onClose} title="Loading Order" description="Please wait">
        <div className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </AdaptiveDialog>
    );
  }

  if (error) {
    return (
      <AdaptiveDialog open={open} onOpenChange={onClose} title="Error" description="Failed to load order">
        <div className="p-8 text-center">
          <p className="text-destructive mb-4">Failed to load order details</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </AdaptiveDialog>
    );
  }

  const orderData = data?.order || order;
  const items = data?.items || [];
  const assignedAgent = data?.assigned_agent;
  const deliverySchedule = data?.delivery_schedule;

  const safeOrder: UnifiedOrder = {
    id: orderData.id || '',
    order_number: orderData.order_number || 'N/A',
    status: orderData.status || 'pending',
    order_type: orderData.order_type || 'delivery',
    customer_name: orderData.customer_name || 'N/A',
    customer_email: orderData.customer_email || 'N/A',
    customer_phone: orderData.customer_phone,
    payment_status: orderData.payment_status || 'pending',
    total_amount: orderData.total_amount || 0,
    created_at: orderData.created_at || new Date().toISOString(),
    updated_at: orderData.updated_at,
    order_time: orderData.order_time || orderData.created_at || new Date().toISOString(),
    items: items,
    delivery_address: orderData.delivery_address,
    delivery_time: orderData.delivery_time,
    delivery_date: orderData.delivery_date,
    pickup_time: orderData.pickup_time,
    special_instructions: orderData.special_instructions,
    subtotal: orderData.subtotal,
    tax_amount: orderData.tax_amount || orderData.vat_amount,
    delivery_fee: orderData.delivery_fee,
    discount_amount: orderData.discount_amount,
    vat_amount: orderData.vat_amount,
    payment_method: orderData.payment_method,
    payment_reference: orderData.payment_reference || orderData.paystack_reference,
    assigned_rider_id: orderData.assigned_rider_id || assignedAgent?.id,
    assigned_rider_name: assignedAgent?.name,
  };

  if (!safeOrder.id) {
    return (
      <AdaptiveDialog open={open} onOpenChange={onClose} title="Invalid Order" description="Order data is missing">
        <div className="p-8 text-center text-destructive">
          Invalid order data
        </div>
      </AdaptiveDialog>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      preparing: 'bg-indigo-500',
      ready: 'bg-purple-500',
      out_for_delivery: 'bg-orange-500',
      delivered: 'bg-green-500',
      cancelled: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      paid: 'bg-green-500',
      failed: 'bg-red-500',
      refunded: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <>
      <AdaptiveDialog 
        open={open} 
        onOpenChange={onClose}
        title={`Order #${safeOrder.order_number}`}
        description={`${safeOrder.order_type} order for ${safeOrder.customer_name}`}
        size="xl"
      >
        <div className="space-y-6 max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b">
            <div className="flex items-center gap-3">
              <Badge className={`${getStatusColor(safeOrder.status)} text-white text-xs sm:text-sm px-2.5 py-1`}>
                {safeOrder.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {format(new Date(safeOrder.order_time), 'MMM dd, yyyy hh:mm a')}
                </span>
                <span className="sm:hidden">
                  {format(new Date(safeOrder.order_time), 'MMM dd, hh:mm a')}
                </span>
              </div>
            </div>
            
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1 sm:flex-none">
                  <Printer className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Print</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {isAdmin && (
            <RealTimeConnectionStatus 
              connectionStatus={connectionStatus}
              lastUpdated={lastUpdated}
              onReconnect={reconnect}
              compact={true}
            />
          )}

          {/* Customer Order Status Tracker - CUSTOMERS ONLY */}
          {!isAdmin && (
            <CustomerOrderStatusTracker
              currentStatus={safeOrder.status}
              orderTime={safeOrder.order_time}
              estimatedDeliveryTime={deliverySchedule?.delivery_time_end}
            />
          )}

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-base">{safeOrder.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-base">{safeOrder.customer_email}</span>
              </div>
              {safeOrder.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-base">{safeOrder.customer_phone}</span>
                  {isAdmin && (() => {
                    // Clean and format Nigerian phone number
                    const cleanNumber = safeOrder.customer_phone.replace(/[^0-9]/g, '');
                    const formattedNumber = cleanNumber.startsWith('234') 
                      ? cleanNumber 
                      : `234${cleanNumber.replace(/^0/, '')}`;
                    
                    // Create dynamic message
                    const message = `Hello ${safeOrder.customer_name}, this is regarding your order #${safeOrder.order_number}. How can I assist you?`;
                    const encodedMessage = encodeURIComponent(message);
                    
                    // Use wa.me universal link (most reliable, rarely blocked)
                    const whatsappUrl = `https://wa.me/${formattedNumber}?text=${encodedMessage}`;
                    
                    return (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center justify-center h-7 w-7 rounded-full bg-[#25D366] hover:bg-[#20BA5A] transition-all duration-200 hover:scale-110 cursor-pointer shadow-sm hover:shadow-md"
                        title="Chat on WhatsApp"
                        aria-label="Chat with customer on WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4 text-white" />
                      </a>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-base">
                <div className="text-muted-foreground">Order Type:</div>
                <div className="font-medium capitalize">{safeOrder.order_type}</div>
                
                <div className="text-muted-foreground">Payment Status:</div>
                <div>
                  <Badge className={`${getPaymentStatusColor(safeOrder.payment_status)} text-white`}>
                    {safeOrder.payment_status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Delivery/Pickup Details */}
              {safeOrder.order_type === 'delivery' ? (
                <>
                  {/* Delivery Address */}
                  {safeOrder.delivery_address && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          Delivery Address
                        </div>
                        <p className="text-sm text-muted-foreground pl-6">
                          {formatAddress(safeOrder.delivery_address)}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Delivery Time Window (1-hour window from delivery_time) */}
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Delivery Window
                    </div>
                    
                    {!hasValidTimeField(safeOrder) ? (
                      <div className="pl-6">
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Data Error:</strong> Missing delivery time for this order. Please contact support.
                          </AlertDescription>
                        </Alert>
                      </div>
                    ) : (
                      <div className="pl-6 space-y-1">
                        {safeOrder.delivery_date && formatDeliveryDate(safeOrder.delivery_date) && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Date:</span>
                            <span className="font-medium">
                              {formatDeliveryDate(safeOrder.delivery_date)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Time:</span>
                          <span className="font-medium">
                            {getOrderTimeWindow(safeOrder) || 'Time not available'}
                          </span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            1-hour window
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : safeOrder.order_type === 'pickup' ? (
                <>
                  {/* Pickup Location */}
                  {isLoadingPickupPoint ? (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          Pickup Location
                        </div>
                        <div className="pl-6 text-sm text-muted-foreground animate-pulse">
                          Loading pickup location...
                        </div>
                      </div>
                    </>
                  ) : pickupPoint ? (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          Pickup Location
                        </div>
                        <div className="pl-6 space-y-1">
                          <p className="text-sm font-medium">{pickupPoint.name}</p>
                          <p className="text-sm text-muted-foreground">{pickupPoint.address}</p>
                          {pickupPoint.contact_phone && (
                            <p className="text-xs text-muted-foreground">📞 {pickupPoint.contact_phone}</p>
                          )}
                          {pickupPoint.instructions && (
                            <p className="text-xs text-muted-foreground italic mt-1">ℹ️ {pickupPoint.instructions}</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {/* Pickup Time Window (1-hour window from pickup_time) */}
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Pickup Time
                    </div>
                    
                    {!hasValidTimeField(safeOrder) ? (
                      <div className="pl-6">
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Data Error:</strong> Missing pickup time for this order. Please contact support.
                          </AlertDescription>
                        </Alert>
                      </div>
                    ) : (
                      <div className="pl-6 space-y-1">
                        {safeOrder.delivery_date && formatDeliveryDate(safeOrder.delivery_date) && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Date:</span>
                            <span className="font-medium">
                              {formatDeliveryDate(safeOrder.delivery_date)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Time Window:</span>
                          <span className="font-medium">
                            {getOrderTimeWindow(safeOrder) || 'Time not available'}
                          </span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            1-hour window
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {/* Special Instructions */}
              {(safeOrder.special_instructions || deliverySchedule?.special_instructions) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Special Instructions
                    </div>
                    <div className="pl-6 space-y-1">
                      {safeOrder.special_instructions && (
                        <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded">
                          {safeOrder.special_instructions}
                        </div>
                      )}
                      {deliverySchedule?.special_instructions && 
                       deliverySchedule.special_instructions !== safeOrder.special_instructions && (
                        <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded">
                          <span className="text-xs font-medium">Delivery: </span>
                          {deliverySchedule.special_instructions}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items found
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item: any) => {
                    const features = item.product?.features 
                      ? parseProductFeatures(item.product.features)
                      : [];
                    
                    const productImage = item.product?.image_url || 
                      (item.product?.images && item.product.images[0]) || 
                      '/placeholder.svg';
                    
                    return (
                      <div key={item.id} className="flex gap-4 p-4 bg-muted/50 rounded-lg border border-border/50 hover:shadow-sm transition-shadow">
                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          <img 
                            src={productImage} 
                            alt={item.product?.name || item.product_name || 'Product'}
                            className="w-20 h-20 rounded-lg object-cover border border-border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-base">
                            {item.product?.name || item.product_name || 'Unknown Product'}
                          </div>
                          
                          {item.product?.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {sanitizeText(item.product.description)}
                            </p>
                          )}

                          {features.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-1">
                              {features.map((feature, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-background/80 rounded-md border">
                                  {feature}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.special_instructions && (
                            <div className="text-sm italic text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                              📝 {item.special_instructions}
                            </div>
                          )}

                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-muted-foreground">
                              Quantity: <span className="font-medium text-foreground">{item.quantity}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Unit Price: <span className="font-medium text-foreground">₦{item.unit_price.toLocaleString()}</span>
                            </span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex-shrink-0 text-right">
                          <div className="font-bold text-lg">
                            ₦{item.total_price.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5" />
                Pricing Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {safeOrder.subtotal !== undefined && (
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>₦{safeOrder.subtotal.toLocaleString()}</span>
                  </div>
                )}
                {safeOrder.tax_amount !== undefined && safeOrder.tax_amount > 0 && (
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Tax/VAT:</span>
                    <span>₦{safeOrder.tax_amount.toLocaleString()}</span>
                  </div>
                )}
                {safeOrder.delivery_fee !== undefined && safeOrder.delivery_fee > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-base">
                      <span className="text-muted-foreground">Delivery Fee:</span>
                      <span>₦{safeOrder.delivery_fee.toLocaleString()}</span>
                    </div>
                    {deliveryZone && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground/70">Delivery Zone:</span>
                        <span className="text-muted-foreground">{deliveryZone.name}</span>
                      </div>
                    )}
                  </div>
                )}
                {safeOrder.discount_amount !== undefined && safeOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-base text-green-600">
                    <span>Discount:</span>
                    <span>-₦{safeOrder.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-xl">
                  <span>Total:</span>
                  <span>₦{safeOrder.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          {(safeOrder.payment_method || safeOrder.payment_reference) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {safeOrder.payment_method && (
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Method:</span>
                    <span className="font-medium capitalize">{safeOrder.payment_method}</span>
                  </div>
                )}
                {safeOrder.payment_reference && (
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Reference:</span>
                    <span className="font-mono text-sm">{safeOrder.payment_reference}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Driver Assignment - ADMIN ONLY */}
          {isAdmin && (
            <DriverAssignmentSection
              orderId={safeOrder.id}
              currentDriverId={safeOrder.assigned_rider_id}
              currentDriverName={safeOrder.assigned_rider_name}
              onAssignDriver={handleAssignDriver}
              isAssigning={assignRiderMutation.isPending}
            />
          )}

          {/* Status Management - ADMIN ONLY */}
          {isAdmin && (
            <StatusManagementSection
              currentStatus={safeOrder.status}
              orderId={safeOrder.id}
              updatedAt={safeOrder.updated_at}
              onUpdateStatus={handleStatusUpdateWithClose}
              isUpdating={false}
            />
          )}
        </div>
      </AdaptiveDialog>

      {/* Hidden print components */}
      <div className="hidden">
        {isAdmin ? (
          <div ref={adminPrintRef}>
            <AdminOrderPrintView
              order={{
                ...safeOrder,
                items: items,
                assigned_rider_name: assignedAgent?.name,
                delivery_schedule: deliverySchedule,
                pickup_point: pickupPoint,
                delivery_zone: deliveryZone,
              }}
              businessSettings={businessSettings}
              adminName={user?.name}
              adminEmail={user?.email}
            />
          </div>
        ) : (
          <div ref={thermalPrintRef}>
            <ThermalPrintReceipt 
              order={safeOrder as unknown as OrderWithItems}
              deliveryZone={deliveryZone}
            />
          </div>
        )}
      </div>
    </>
  );
}
