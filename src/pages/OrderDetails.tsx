import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Clock, CheckCircle, CreditCard, Package, Truck, Calendar, User, Phone, Mail, MapPin, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useToast } from '@/hooks/use-toast';
import { useNetworkResilience } from '@/hooks/useNetworkResilience';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { DeliveryScheduleCard } from '@/components/orders/DeliveryScheduleCard';
import { FullDeliveryInformation } from '@/components/customer/FullDeliveryInformation';
import { getDeliveryScheduleByOrderId, DeliverySchedule } from '@/api/deliveryScheduleApi';
import { usePickupPoints } from '@/hooks/usePickupPoints';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
interface OrderDetailsData {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  paid_at?: string | null;
  total_amount: number;
  order_time: string;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_name?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  order_type: 'delivery' | 'pickup';
  delivery_address?: any;
  pickup_point_id?: string | null;
  special_instructions?: string | null;
  delivery_notes?: string | null;
  estimated_delivery_date?: string | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string | null;
}

interface PaymentTx {
  provider_reference?: string | null;
  status?: string | null;
  amount?: number | null;
  channel?: string | null;
  gateway_response?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  paid_at?: string | null;
}

const formatMoney = (value?: number | null) => {
  const v = value || 0;
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(v);
  } catch {
    return `₦${v.toLocaleString()}`;
  }
};

const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return 'Not available';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Date formatting error:', error);
    return 'Invalid date';
  }
};

const formatTime = (timeString?: string | null): string => {
  if (!timeString) return 'Not set';
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  } catch {
    return timeString;
  }
};

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Order Placed', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  confirmed: { label: 'Order Confirmed', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
  preparing: { label: 'Being Prepared', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Package },
  ready: { label: 'Ready for Delivery', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Package },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
};

const paymentStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending Payment', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800 border-green-200' },
  failed: { label: 'Payment Failed', color: 'bg-red-100 text-red-800 border-red-200' },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

const SectionSkeleton = () => (
  <div className="space-y-4">
    {[1, 2].map((i) => (
      <Card key={i} className="p-6">
        <Skeleton className="h-4 w-1/3 mb-3" />
        <Skeleton className="h-4 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </Card>
    ))}
  </div>
);

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, customerAccount, user, isLoading } = useCustomerAuth();
  const { toast } = useToast();
  const [order, setOrder] = React.useState<OrderDetailsData | null>(null);
  const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
  const [tx, setTx] = React.useState<PaymentTx | null>(null);
  const [deliverySchedule, setDeliverySchedule] = React.useState<DeliverySchedule | null>(null);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const { data: pickupPoints = [] } = usePickupPoints();

  // Use detailed order data hook with network resilience
  const detailedOrderQuery = useDetailedOrderData(id || '');
  const detailedOrderWithResilience = useNetworkResilience(detailedOrderQuery, {
    fallbackData: null,
    onError: (error) => {
      console.error('Network error in detailed order data:', error);
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          detailedOrderQuery.refetch();
        }, 2000 * Math.pow(2, retryCount)); // Exponential backoff
      }
    },
    showToast: false // Handle toasts manually for better UX
  });

  const canView = React.useMemo(() => {
    if (!order) return false;
    
    const userEmail = (user?.email || customerAccount?.email || '').toLowerCase().trim();
    const orderEmail = (order.customer_email || '').toLowerCase().trim();
    
    return (
      (!!customerAccount?.id && order.customer_id === customerAccount.id) ||
      (!!userEmail && !!orderEmail && userEmail === orderEmail)
    );
  }, [order, customerAccount?.id, customerAccount?.email, user?.email]);

const loadData = React.useCallback(async () => {
  if (!id) return;
  try {
    setIsLoadingData(true);
    setError(null);
    
    // Enhanced order data fetch with additional fields
    const { data: orderData, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, payment_status, paid_at, total_amount, order_time,
        customer_id, customer_email, customer_phone, customer_name, payment_method, payment_reference,
        order_type, delivery_address, pickup_point_id, special_instructions, estimated_delivery_date
      `)
      .eq('id', id)
      .maybeSingle();
    
    if (orderErr) throw orderErr;
    if (!orderData) throw new Error('Order not found');

    setOrder(orderData as OrderDetailsData);

    // Fetch order items
    try {
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, unit_price, total_price, special_instructions')
        .eq('order_id', id)
        .order('created_at', { ascending: true });
      
      if (itemsErr) {
        console.warn('Order items fetch error:', itemsErr);
      } else {
        setOrderItems(itemsData || []);
      }
    } catch (itemsError) {
      console.warn('Failed to load order items:', itemsError);
    }

    // Fetch payment transaction
    const { data: txData, error: txErr } = await supabase
      .from('payment_transactions')
      .select('provider_reference,status,amount,channel,gateway_response,created_at,updated_at,paid_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (txErr) {
      console.warn('Payment transaction fetch error:', txErr);
    }
    setTx((txData || null) as PaymentTx | null);

    // Load delivery schedule with error handling
    try {
      const scheduleData = await getDeliveryScheduleByOrderId(id);
      setDeliverySchedule(scheduleData);
    } catch (scheduleErr) {
      console.warn('Delivery schedule fetch error:', scheduleErr);
    }
  } catch (e: any) {
    console.error('Order details loading error:', e);
    setError(e.message || 'Failed to load order details');
    
    // Show error toast only on critical failures
    if (retryCount === 0) {
      toast({
        title: "Loading Error",
        description: "Failed to load order details. Retrying...",
        variant: "destructive",
      });
    }
  } finally {
    setIsLoadingData(false);
  }
}, [id, toast, retryCount]);

React.useEffect(() => {
  loadData();
}, [loadData]);

// Realtime refresh when order, payment transactions, or delivery schedules update
React.useEffect(() => {
  if (!id) return;
  const channel = supabase
    .channel(`order-details-${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => {
      console.log('Order updated, refreshing data...');
      loadData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions', filter: `order_id=eq.${id}` }, () => {
      console.log('Payment transaction updated, refreshing data...');
      loadData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_delivery_schedule', filter: `order_id=eq.${id}` }, () => {
      console.log('Delivery schedule updated, refreshing data...');
      loadData();
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [id, loadData]);

const refreshNow = async () => {
  setRetryCount(0); // Reset retry count on manual refresh
  await loadData();
};

const retryLoad = async () => {
  setRetryCount(prev => prev + 1);
  await loadData();
};

const reconcileNow = async () => {
  const ref = tx?.provider_reference || (order as any)?.payment_reference;
  if (!ref) {
    toast({ title: 'No payment reference', description: 'Cannot reconcile without a payment reference.', variant: 'destructive' });
    return;
  }
  try {
    setIsReconciling(true);
    const fb = await supabase.functions.invoke('paystack-secure', { body: { action: 'verify', reference: ref } });
    if (fb.error) throw fb.error;
    toast({ title: 'Verification triggered', description: 'Refreshing payment status…' });
    setTimeout(() => { loadData(); }, 1500);
  } catch (e: any) {
    toast({ title: 'Reconciliation failed', description: e.message || 'Unable to verify payment', variant: 'destructive' });
  } finally {
    setIsReconciling(false);
  }
};

  if (isLoading || isLoadingData) return <SectionSkeleton />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto p-6 max-w-4xl">
          <Alert className="border-destructive bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <p className="font-medium">Failed to load order details</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={retryLoad} disabled={isLoadingData}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  
  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto p-6 max-w-4xl">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">Order not found</p>
              <p className="text-sm text-muted-foreground mt-1">The order you're looking for doesn't exist or may have been removed.</p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  
  if (!canView) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto p-6 max-w-4xl">
          <Alert className="border-destructive bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">Access denied</p>
              <p className="text-sm text-muted-foreground mt-1">You don't have permission to view this order.</p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Enhanced status and payment logic
  const orderStatus = (order.status || '').toLowerCase();
  const paymentStatus = (order.payment_status || '').toLowerCase();
  
  const currentStatus = statusMap[orderStatus] || statusMap.pending;
  const currentPaymentStatus = paymentStatusMap[paymentStatus] || paymentStatusMap.pending;
  
  // Calculate totals from order items
  const subtotal = orderItems.reduce((sum, item) => sum + (item.total_price || item.unit_price * item.quantity), 0);
  const vatAmount = order.total_amount - subtotal;
  
  // Get help content based on status
  const getHelpContent = () => {
    if (paymentStatus === 'pending') {
      return {
        title: "Payment Pending",
        description: "Your payment is being processed. This usually takes a few minutes.",
        action: "If you've already paid, try refreshing the page or contact support with your order number."
      };
    }
    if (orderStatus === 'confirmed') {
      return {
        title: "Order Confirmed",
        description: "Your order has been confirmed and is being prepared.",
        action: "We'll notify you when your order is ready for delivery."
      };
    }
    return null;
  };

  // Find the pickup point for this order if it's a pickup order
  const currentPickupPoint = order.pickup_point_id 
    ? pickupPoints.find(point => point.id === order.pickup_point_id) 
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Order {order.order_number} - Payment Status & Details</title>
        <meta name="description" content={`View payment status and details for order ${order.order_number}.`} />
        <link rel="canonical" href={`${window.location.origin}/orders/${order.id}`} />
      </Helmet>

      <PublicHeader />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Order {order.order_number}</h1>
            <p className="text-muted-foreground">Placed on {formatDateTime(order.order_time)}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={`text-xs border ${currentStatus.color}`}>
                <currentStatus.icon className="h-3 w-3 mr-1" />
                {currentStatus.label}
              </Badge>
              <Badge className={`text-xs border ${currentPaymentStatus.color}`}>
                <CreditCard className="h-3 w-3 mr-1" />
                {currentPaymentStatus.label}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshNow} disabled={isLoadingData}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Help Section */}
        {getHelpContent() && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <HelpCircle className="h-4 w-4" />
            <AlertDescription>
              <div>
                <p className="font-medium">{getHelpContent()?.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{getHelpContent()?.description}</p>
                <p className="text-sm text-blue-600 mt-2">{getHelpContent()?.action}</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Customer Information */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {order.customer_name && (
              <div>
                <p className="text-sm text-muted-foreground">Customer Name</p>
                <p className="font-medium">{order.customer_name}</p>
              </div>
            )}
            {order.customer_email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{order.customer_email}</p>
                </div>
              </div>
            )}
            {order.customer_phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{order.customer_phone}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Order Items */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </h2>
          <div className="space-y-4">
            {orderItems.length > 0 ? (
              orderItems.map((item, index) => (
                <div key={item.id || index} className="flex justify-between items-start border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                    {item.special_instructions && (
                      <p className="text-sm text-blue-600 mt-1">
                        Note: {item.special_instructions}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatMoney(item.total_price || item.unit_price * item.quantity)}</p>
                    <p className="text-sm text-muted-foreground">{formatMoney(item.unit_price)} each</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Order items not available</p>
                <p className="text-sm">This may be an older order or items data is being loaded.</p>
              </div>
            )}
          </div>
          
          {/* Order Totals */}
          <div className="border-t border-gray-200 mt-4 pt-4 space-y-2">
            {orderItems.length > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                {vatAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>VAT</span>
                    <span>{formatMoney(vatAmount)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between font-semibold text-lg border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{formatMoney(order.total_amount)}</span>
            </div>
          </div>
        </Card>

        {/* Payment Information */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <p className="font-medium capitalize">{order.payment_method || 'Paystack'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Status</p>
              <Badge className={`text-xs border ${currentPaymentStatus.color}`}>
                {currentPaymentStatus.label}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="font-semibold">{formatMoney(order.total_amount)}</p>
            </div>
            {order.payment_reference && (
              <div>
                <p className="text-sm text-muted-foreground">Payment Reference</p>
                <p className="font-mono text-sm break-all">{order.payment_reference}</p>
              </div>
            )}
            {tx?.channel && (
              <div>
                <p className="text-sm text-muted-foreground">Payment Channel</p>
                <p className="font-medium capitalize">{tx.channel}</p>
              </div>
            )}
            {order.paid_at && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Paid At</p>
                <p className="font-medium">{formatDateTime(order.paid_at)}</p>
              </div>
            )}
            {paymentStatus === 'pending' && (order.payment_reference || tx?.provider_reference) && (
              <div className="md:col-span-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={reconcileNow} 
                  disabled={isReconciling}
                  className="w-full sm:w-auto"
                >
                  {isReconciling ? 'Verifying...' : 'Verify Payment'}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Full Delivery Information Component */}
        <FullDeliveryInformation 
          order={order}
          deliverySchedule={deliverySchedule}
          pickupPoint={currentPickupPoint}
          className="mb-6"
        />

        {/* Enhanced Timeline */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Order Timeline</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Order Placed</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(order.order_time)}</p>
              </div>
            </div>
            
            {order.paid_at && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Payment Confirmed</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(order.paid_at)}</p>
                  {tx?.channel && (
                    <p className="text-xs text-blue-600">via {tx.channel}</p>
                  )}
                </div>
              </div>
            )}
            
            {orderStatus === 'confirmed' && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Order Confirmed</p>
                  <p className="text-sm text-muted-foreground">Being prepared</p>
                </div>
              </div>
            )}
            
            {deliverySchedule && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Delivery Scheduled</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(deliverySchedule.delivery_date).toLocaleDateString('en-NG', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-xs text-purple-600">
                    {formatTime(deliverySchedule.delivery_time_start)} - {formatTime(deliverySchedule.delivery_time_end)}
                  </p>
                  {deliverySchedule.special_instructions && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Instructions: {deliverySchedule.special_instructions}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {['out_for_delivery', 'delivered', 'completed'].includes(orderStatus) && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <Truck className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium">{currentStatus.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {orderStatus === 'delivered' ? 'Successfully delivered' : 
                     orderStatus === 'completed' ? 'Order completed' : 
                     'On the way to you'}
                  </p>
                </div>
              </div>
            )}
            
            {order.estimated_delivery_date && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium">Estimated Delivery</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(order.estimated_delivery_date)}</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
