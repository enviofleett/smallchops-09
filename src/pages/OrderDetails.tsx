import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Clock, CheckCircle, CreditCard, Package, Truck, Calendar } from 'lucide-react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useToast } from '@/hooks/use-toast';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { DeliveryScheduleCard } from '@/components/orders/DeliveryScheduleCard';
import { getDeliveryScheduleByOrderId, DeliverySchedule } from '@/api/deliveryScheduleApi';
interface OrderDetailsData {
  id: string;
  order_number: string;
  status: string;
  payment_status?: string | null;
  paid_at?: string | null;
  total_amount: number;
  order_time: string;
  customer_id?: string | null;
  customer_email?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
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
const { id } = useParams();
const { isAuthenticated, customerAccount, user, isLoading } = useCustomerAuth();
const { toast } = useToast();
const [order, setOrder] = React.useState<OrderDetailsData | null>(null);
const [tx, setTx] = React.useState<PaymentTx | null>(null);
const [deliverySchedule, setDeliverySchedule] = React.useState<DeliverySchedule | null>(null);
const [isLoadingData, setIsLoadingData] = React.useState(true);
const [isReconciling, setIsReconciling] = React.useState(false);
const [error, setError] = React.useState<string | null>(null);

  const canView = React.useMemo(() => {
    if (!order) return false;
    const email = (user?.email || customerAccount?.email || '').toLowerCase();
    const orderEmail = (order.customer_email || '').toLowerCase();
    return (
      (!!customerAccount?.id && order.customer_id === customerAccount.id) ||
      (!!email && !!orderEmail && email === orderEmail)
    );
  }, [order, customerAccount?.id, user?.email]);

React.useEffect(() => {}, []); // placeholder to keep effect order

const loadData = React.useCallback(async () => {
  if (!id) return;
  try {
    setIsLoadingData(true);
    setError(null);
    const { data: orderData, error: orderErr } = await supabase
      .from('orders')
      .select(`
            id, order_number, status, payment_status, paid_at, total_amount, order_time,
            customer_id, customer_email, payment_method, payment_reference
          `)
      .eq('id', id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!orderData) throw new Error('Order not found');

    setOrder(orderData as OrderDetailsData);

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
    console.error(e);
    setError(e.message || 'Failed to load order details');
  } finally {
    setIsLoadingData(false);
  }
}, [id]);

React.useEffect(() => {
  loadData();
}, [loadData]);

// Realtime refresh when order or payment transactions update
React.useEffect(() => {
  if (!id) return;
  const channel = supabase
    .channel(`order-details-${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => loadData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions', filter: `order_id=eq.${id}` }, () => loadData())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [id, loadData]);

const refreshNow = async () => {
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
  if (error) return <div className="container mx-auto p-6"><p className="text-destructive">{error}</p></div>;
  if (!order) return <div className="container mx-auto p-6"><p>Order not found.</p></div>;
  if (!canView) return <div className="container mx-auto p-6"><p>Access denied.</p></div>;

  // Payment badge logic
  const paymentStatus = (order.payment_status || '').toLowerCase();
  const orderStatus = (order.status || '').toLowerCase();
  let paymentBadge = { label: 'PENDING PAYMENT', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  if (paymentStatus === 'paid' || !!order.paid_at) paymentBadge = { label: 'PAID', cls: 'bg-green-100 text-green-800 border-green-200' };
  else if (paymentStatus === 'failed') paymentBadge = { label: 'PAYMENT FAILED', cls: 'bg-red-100 text-red-800 border-red-200' };
  else if (paymentStatus === 'pending' && orderStatus === 'confirmed') paymentBadge = { label: 'CONFIRMED', cls: 'bg-blue-100 text-blue-800 border-blue-200' };

  const formatDateTime = (d?: string | null) => d ? new Date(d).toLocaleString() : undefined;

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
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshNow} disabled={isLoadingData}>Refresh status</Button>
          </div>
        </div>

        {/* Delivery Schedule - Show prominently if available */}
        {deliverySchedule && (
          <div className="mb-6">
            <DeliveryScheduleCard 
              schedule={deliverySchedule} 
              orderStatus={order.status}
              className="shadow-sm"
            />
          </div>
        )}

        {/* Status Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="text-sm">Order Status</span>
            </div>
            <Badge className={`text-xs border ${paymentBadge.cls}`}>{paymentBadge.label}</Badge>
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="text-sm">Amount</span>
            </div>
            <span className="font-semibold">{formatMoney(order.total_amount)}</span>
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Paid At</span>
            </div>
            <span className="text-sm">{formatDateTime(order.paid_at) || '-'}</span>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Order Timeline</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Ordered: {formatDateTime(order.order_time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>Paid: {formatDateTime(order.paid_at || tx?.paid_at || tx?.updated_at) || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Confirmed: {order.status?.toLowerCase() === 'confirmed' ? (formatDateTime(order.paid_at || order.order_time) || '—') : '—'}</span>
            </div>
            {['out_for_delivery','shipped','delivered','completed'].includes((order.status || '').toLowerCase()) && (
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <span>Current Status: {order.status}</span>
              </div>
            )}
            {deliverySchedule && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Delivery Scheduled: {formatDateTime(deliverySchedule.delivery_date)} at {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
