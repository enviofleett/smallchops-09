import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { 
  Clock, 
  CheckCircle, 
  CreditCard, 
  Package, 
  Truck, 
  Calendar, 
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  Info,
  RefreshCw,
  User
} from 'lucide-react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useToast } from '@/hooks/use-toast';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { DeliveryScheduleCard } from '@/components/orders/DeliveryScheduleCard';
import { FullDeliveryInformation } from '@/components/customer/FullDeliveryInformation';
import { getDeliveryScheduleByOrderId, DeliverySchedule } from '@/api/deliveryScheduleApi';
import { usePickupPoints } from '@/hooks/usePickupPoints';

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
  payment_method?: string | null;
  payment_reference?: string | null;
  order_type: 'delivery' | 'pickup';
  delivery_address?: any;
  pickup_point_id?: string | null;
  special_instructions?: string | null;
  
  estimated_delivery_date?: string | null;
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

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

const formatMoney = (value?: number | null): string => {
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
  } catch {
    return 'Invalid date';
  }
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return 'Not scheduled';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleDateString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
};

const getOrderStatusInfo = (status: string) => {
  const statusLower = status.toLowerCase();
  const statusMap = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
    confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
    preparing: { label: 'Preparing', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Package },
    ready_for_pickup: { label: 'Ready for Pickup', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Package },
    out_for_delivery: { label: 'Out for Delivery', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Truck },
    shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Truck },
    delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle }
  };
  
  return statusMap[statusLower] || { 
    label: status, 
    color: 'bg-gray-100 text-gray-800 border-gray-200', 
    icon: Info 
  };
};

const SectionSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <Card key={i} className="p-6">
        <Skeleton className="h-4 w-1/3 mb-3" />
        <Skeleton className="h-4 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </Card>
    ))}
  </div>
);

export default function OrderDetails() {
  const { id } = useParams();
  const { isAuthenticated, customerAccount, user, isLoading } = useCustomerAuth();
  const { toast } = useToast();
  const [order, setOrder] = React.useState<OrderDetailsData | null>(null);
  const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
  const [tx, setTx] = React.useState<PaymentTx | null>(null);
  const [deliverySchedule, setDeliverySchedule] = React.useState<DeliverySchedule | null>(null);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { data: pickupPoints = [] } = usePickupPoints();

  const canView = React.useMemo(() => {
    if (!order) return false;
    const email = (user?.email || customerAccount?.email || '').toLowerCase().trim();
    const orderEmail = (order.customer_email || '').toLowerCase().trim();
    return (
      (!!customerAccount?.id && order.customer_id === customerAccount.id) ||
      (!!email && !!orderEmail && email === orderEmail)
    );
  }, [order, customerAccount?.id, customerAccount?.email, user?.email]);

  const loadData = React.useCallback(async () => {
    if (!id) {
      setError('No order ID provided');
      setIsLoadingData(false);
      return;
    }

    try {
      setIsLoadingData(true);
      setError(null);

      // Load order details
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, paid_at, total_amount, order_time,
          customer_id, customer_email, customer_phone, payment_method, payment_reference,
          order_type, delivery_address, pickup_point_id, special_instructions,
          estimated_delivery_date
        `)
        .eq('id', id)
        .maybeSingle();

      if (orderErr) throw new Error(`Failed to load order: ${orderErr.message}`);
      if (!orderData) throw new Error('Order not found');

      setOrder(orderData as OrderDetailsData);

      // Load order items
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, unit_price, total_price')
        .eq('order_id', id);

      if (itemsErr) {
        console.warn('Order items fetch error:', itemsErr);
      } else {
        setOrderItems(itemsData || []);
      }

      // Load payment transaction
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

      // Load delivery schedule
      try {
        const scheduleData = await getDeliveryScheduleByOrderId(id);
        setDeliverySchedule(scheduleData);
      } catch (scheduleErr) {
        console.warn('Delivery schedule fetch error:', scheduleErr);
      }

    } catch (e: any) {
      console.error('Error loading order data:', e);
      setError(e.message || 'Failed to load order details');
    } finally {
      setIsLoadingData(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime updates
  React.useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-details-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => {
          console.log('Order updated, refreshing...');
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_transactions', filter: `order_id=eq.${id}` },
        () => {
          console.log('Payment transaction updated, refreshing...');
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_schedules', filter: `order_id=eq.${id}` },
        () => {
          console.log('Delivery schedule updated, refreshing...');
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadData]);

  const refreshNow = async () => {
    await loadData();
    toast({
      title: 'Refreshed',
      description: 'Order details have been updated.',
    });
  };

  const reconcileNow = async () => {
    const ref = tx?.provider_reference || order?.payment_reference;
    if (!ref) {
      toast({
        title: 'No payment reference',
        description: 'Cannot reconcile without a payment reference.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsReconciling(true);
      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference: ref }
      });

      if (error) throw error;

      toast({
        title: 'Verification triggered',
        description: 'Payment status is being updated...'
      });

      // Refresh after a short delay to allow backend processing
      setTimeout(() => {
        loadData();
      }, 2000);

    } catch (e: any) {
      console.error('Payment reconciliation error:', e);
      toast({
        title: 'Reconciliation failed',
        description: e.message || 'Unable to verify payment status',
        variant: 'destructive'
      });
    } finally {
      setIsReconciling(false);
    }
  };

  // Loading state
  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <SectionSkeleton />
        </div>
      </div>
    );
  }

  // Authentication check
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={loadData} disabled={isLoadingData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Order not found
  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Order not found.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Access denied
  if (!canView) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to view this order.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Payment status logic
  const paymentStatus = (order.payment_status || '').toLowerCase();
  const orderStatus = (order.status || '').toLowerCase();
  let paymentBadge = { 
    label: 'PENDING PAYMENT', 
    cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' 
  };
  
  if (paymentStatus === 'paid' || !!order.paid_at) {
    paymentBadge = { label: 'PAID', cls: 'bg-green-100 text-green-800 border-green-200' };
  } else if (paymentStatus === 'failed') {
    paymentBadge = { label: 'PAYMENT FAILED', cls: 'bg-red-100 text-red-800 border-red-200' };
  } else if (paymentStatus === 'pending' && orderStatus === 'confirmed') {
    paymentBadge = { label: 'CONFIRMED', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
  }

  const orderStatusInfo = getOrderStatusInfo(order.status);
  const currentPickupPoint = order.pickup_point_id 
    ? pickupPoints.find(point => point.id === order.pickup_point_id) 
    : null;

  const StatusIcon = orderStatusInfo.icon;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Order {order.order_number} - Order Details & Status</title>
        <meta name="description" content={`View complete details and status for order ${order.order_number}.`} />
        <link rel="canonical" href={`${window.location.origin}/orders/${order.id}`} />
      </Helmet>

      <PublicHeader />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Order {order.order_number}</h1>
            <p className="text-muted-foreground">
              Placed on {formatDateTime(order.order_time)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={refreshNow} 
              disabled={isLoadingData}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Order Status */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <StatusIcon className="h-5 w-5" />
            Order Status
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <Badge className={`text-sm border ${orderStatusInfo.color} mb-2`}>
                {orderStatusInfo.label}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Last updated: {formatDateTime(tx?.updated_at || order.order_time)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-2xl">{formatMoney(order.total_amount)}</p>
              <p className="text-sm text-muted-foreground">Total Amount</p>
            </div>
          </div>
        </Card>

        {/* Payment Information */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
              <p className="font-medium capitalize">{order.payment_method || 'Paystack'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Payment Status</p>
              <Badge className={`text-xs border ${paymentBadge.cls}`}>
                {paymentBadge.label}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Amount</p>
              <p className="font-semibold text-lg">{formatMoney(order.total_amount)}</p>
            </div>
            {(order.payment_reference || tx?.provider_reference) && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Payment Reference</p>
                <p className="font-mono text-sm break-all bg-muted p-2 rounded">
                  {order.payment_reference || tx?.provider_reference}
                </p>
              </div>
            )}
            {order.paid_at && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-1">Payment Date</p>
                <p className="font-medium">{formatDateTime(order.paid_at)}</p>
              </div>
            )}
            {tx && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-1">Payment Channel</p>
                <p className="font-medium capitalize">{tx.channel || 'Online'}</p>
              </div>
            )}
          </div>
          
          {paymentStatus !== 'paid' && !order.paid_at && (order.payment_reference || tx?.provider_reference) && (
            <div className="mt-4 pt-4 border-t">
              <Button 
                onClick={reconcileNow} 
                disabled={isReconciling}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isReconciling ? 'animate-spin' : ''}`} />
                Verify Payment Status
              </Button>
            </div>
          )}
        </Card>

        {/* Customer Information */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {order.customer_email && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {order.customer_email}
                </p>
              </div>
            )}
            {order.customer_phone && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Phone</p>
                <p className="font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {order.customer_phone}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Delivery Information */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {order.order_type === 'pickup' ? <Package className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
            {order.order_type === 'pickup' ? 'Pickup Information' : 'Delivery Information'}
          </h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Order Type</p>
              <p className="font-medium capitalize">{order.order_type}</p>
            </div>

            {order.order_type === 'pickup' && currentPickupPoint && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Pickup Location</p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-medium">{currentPickupPoint.name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-4 w-4" />
                    {currentPickupPoint.address}
                  </p>
                </div>
              </div>
            )}

            {order.order_type === 'delivery' && order.delivery_address && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Delivery Address</p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {typeof order.delivery_address === 'string' 
                        ? order.delivery_address 
                        : JSON.stringify(order.delivery_address)
                      }
                    </span>
                  </p>
                </div>
              </div>
            )}

            {deliverySchedule && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Scheduled Delivery</p>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(deliverySchedule.delivery_date)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Time window: {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}
                  </p>
                  {deliverySchedule.special_instructions && (
                    <p className="text-sm mt-2">
                      <span className="font-medium">Instructions: </span>
                      {deliverySchedule.special_instructions}
                    </p>
                  )}
                </div>
              </div>
            )}

            {order.estimated_delivery_date && !deliverySchedule && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Estimated Delivery</p>
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(order.estimated_delivery_date)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This is an estimated date and may change
                  </p>
                </div>
              </div>
            )}

            {order.special_instructions && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Special Instructions</p>
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <p className="text-sm">
                    {order.special_instructions}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Order Items */}
        {orderItems.length > 0 && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items ({orderItems.length} {orderItems.length === 1 ? 'item' : 'items'})
            </h2>
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantity: {item.quantity} × {formatMoney(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-semibold">{formatMoney(item.total_price)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Order Timeline */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Order Timeline
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Order Placed</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(order.order_time)}</p>
              </div>
            </div>
            
            {(order.paid_at || tx?.paid_at) && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <CreditCard className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Status: {orderStatusInfo.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(tx?.updated_at || order.order_time)}
                  </p>
                </div>
              </div>
            )}
            
            {deliverySchedule && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">Delivery Scheduled</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(deliverySchedule.delivery_date)} from {deliverySchedule.delivery_time_start} to {deliverySchedule.delivery_time_end}
                  </p>
                </div>
              </div>
            )}
            
            {order.status?.toLowerCase() === 'cancelled' && (
              <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium">Order Cancelled</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(tx?.updated_at || order.order_time)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Help Information */}
        {(paymentStatus !== 'paid' || ['pending', 'failed'].includes(orderStatus)) && (
          <Card className="p-6 mt-6 border-yellow-200 bg-yellow-50">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-yellow-800">
              <Info className="h-5 w-5" />
              Need Help?
            </h3>
            <div className="space-y-2 text-sm text-yellow-700">
              {paymentStatus !== 'paid' && (
                <p>• If you've made payment but it's not reflected, try using the "Verify Payment Status" button above.</p>
              )}
              <p>• Order status updates automatically when payment is confirmed.</p>
              <p>• For urgent matters, contact customer support with your order number: <span className="font-mono font-medium">{order.order_number}</span></p>
              {order.customer_email && (
                <p>• Updates will be sent to: <span className="font-medium">{order.customer_email}</span></p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
