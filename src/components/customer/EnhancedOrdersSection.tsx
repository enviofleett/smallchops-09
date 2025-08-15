import React, { useEffect } from 'react';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShoppingBag, 
  Clock, 
  ChevronRight,
  AlertTriangle,
  Package,
  Truck,
  CheckCircle
} from 'lucide-react';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  order_time: string;
  customer_name: string;
  customer_email: string;
  // Payment-related fields (may be missing in some responses)
  payment_status?: string;
  paid_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  order_items?: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    products?: {
      name: string;
      image_url?: string;
    };
  }>;
}

const ContentSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map(i => (
      <Card key={i} className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    ))}
  </div>
);

export function EnhancedOrdersSection() {
  const { data: ordersData, isLoading: ordersLoading, error: ordersError, refetch } = useCustomerOrders() as any;
  const { handleError } = useErrorHandler();

  // Proactively refetch on mount to avoid stale states
  useEffect(() => {
    refetch?.();
  }, [refetch]);

  // Listen for payment confirmation events and show a toast
  useEffect(() => {
    const handler = (event: any) => {
      try {
        const { orderId } = event.detail || {};
        const shortId = (orderId || '').toString().slice(-8);
        toast.success('Payment confirmed', {
          description: shortId ? `Order ${shortId} has been paid successfully` : 'Order has been paid successfully',
          duration: 4000,
        });
      } catch {}
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('payment-confirmed', handler as unknown as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('payment-confirmed', handler as unknown as EventListener);
      }
    };
  }, []);

// Safe data access with null checks (prepare before effects)
const orders = Array.isArray(ordersData?.orders) ? (ordersData.orders as any[]) : [];

// Derived paid-state map from payment_transactions for current orders
const [paidMap, setPaidMap] = React.useState<Record<string, boolean>>({});

useEffect(() => {
  const fetchPayments = async () => {
    try {
      const ids = (orders || []).map((o: any) => o.id);
      const refs = (orders || []).map((o: any) => o.payment_reference).filter(Boolean);
      if (!ids.length && !refs.length) return;

      // Query by order_id
      let byOrder: any[] | undefined;
      if (ids.length) {
        const { data, error } = await supabase
          .from('payment_transactions')
          .select('order_id,status,paid_at')
          .in('order_id', ids);
        if (error) throw error;
        byOrder = data as any[];
      }

      // Query by provider_reference
      let byRef: any[] | undefined;
      if (refs.length) {
        const { data, error } = await supabase
          .from('payment_transactions')
          .select('provider_reference,status,paid_at')
          .in('provider_reference', refs);
        if (error) throw error;
        byRef = data as any[];
      }

      const map: Record<string, boolean> = {};

      (byOrder || []).forEach((tx: any) => {
        const st = (tx?.status || '').toLowerCase();
        if (st === 'success' || st === 'paid' || !!tx?.paid_at) {
          map[tx.order_id] = true;
        }
      });

      if (byRef) {
        const refPaid = new Set<string>();
        byRef.forEach((tx: any) => {
          const st = (tx?.status || '').toLowerCase();
          if (st === 'success' || st === 'paid' || !!tx?.paid_at) {
            refPaid.add(tx.provider_reference);
          }
        });
        (orders || []).forEach((o: any) => {
          if (o?.payment_reference && refPaid.has(o.payment_reference)) {
            map[o.id] = true;
          }
        });
      }

      setPaidMap(map);
    } catch (e) {
      console.warn('Failed to fetch payment transactions for orders:', e);
    }
  };
  fetchPayments();
}, [orders]);



// Auto-reconcile recent pending Paystack orders
useEffect(() => {
  if (ordersLoading) return;
  const list = Array.isArray(orders) ? orders : [];
  const candidates = list.filter((o: any) => {
    const pm = (o?.payment_method || '').toLowerCase();
    const ps = (o?.payment_status || '').toLowerCase();
    return pm === 'paystack' && ps !== 'paid' && !!o?.payment_reference;
  });
  if (candidates.length === 0) return;

  (async () => {
    try {
      const refs = candidates.slice(0, 10).map((o: any) => o.payment_reference);
      for (const ref of refs) {
        try {
          await supabase.functions.invoke('paystack-secure', {
            body: { action: 'verify', reference: ref }
          });
        } catch (inner) {
          console.warn('Verify attempt failed for ref', ref, inner);
        }
      }
      await (refetch?.());
    } catch (e) {
      console.warn('Auto-reconcile verify failed:', e);
    }
  })();
}, [ordersLoading, ordersData]);

// Handle query errors after effects are set up
if (ordersError) {
  console.error('Orders query error:', ordersError);
  handleError(ordersError, 'loading orders');
  return (
    <Card className="p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">Unable to load orders</h3>
      <p className="text-gray-500 mb-4">There was a problem loading your orders. Please try again.</p>
      <Button onClick={() => window.location.reload()}>
        Refresh Page
      </Button>
    </Card>
  );
}

// Loading state
if (ordersLoading) {
  return <ContentSkeleton />;
}

// Empty state
if (orders.length === 0) {
  return (
    <Card className="p-8 text-center">
      <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
      <p className="text-gray-500 mb-4">You haven't placed any orders yet</p>
      <Button onClick={() => window.location.href = '/products'}>
        Start Shopping
      </Button>
    </Card>
  );
}

return (
  <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">My Orders</h2>
          <p className="text-gray-500">Track and manage all your orders</p>
        </div>
        {/* Optional filter button placeholder */}
      </div>

{/* Recent Orders */}
<div className="space-y-4">
  {orders.map((order) => (
    <OrderCard
      key={order.id}
      order={order}
      paid={(order.payment_status === 'paid') || !!order.paid_at || !!paidMap[order.id]}
    />
  ))}
</div>

      {/* Load More Button */}
      {orders.length >= 10 && (
        <div className="text-center">
          <Button variant="outline">
            Load More Orders
          </Button>
        </div>
      )}
    </div>
  );
}

// Enhanced Order Card component
const OrderCard = React.memo(({ order, paid = false }: { order: Order; paid?: boolean }) => {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'out_for_delivery':
      case 'shipped':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing':
      case 'processing':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'confirmed':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'out_for_delivery':
      case 'shipped':
        return <Truck className="w-4 h-4" />;
      case 'preparing':
      case 'processing':
        return <Package className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getProgressWidth = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'pending':
        return '25%';
      case 'preparing':
      case 'processing':
        return '50%';
      case 'out_for_delivery':
      case 'shipped':
        return '75%';
      case 'delivered':
      case 'completed':
        return '100%';
      default:
        return '10%';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Payment badge display logic (priority)
  const getPaymentBadge = () => {
    const ps = (order.payment_status || '').toLowerCase();
    const os = (order.status || '').toLowerCase();

    if (ps === 'paid' || paid || !!order.paid_at) {
      return { label: 'PAID', cls: 'bg-green-100 text-green-800 border-green-200' };
    }
    if (ps === 'failed') {
      return { label: 'PAYMENT FAILED', cls: 'bg-red-100 text-red-800 border-red-200' };
    }
    if (ps === 'pending' && os === 'confirmed') {
      return { label: 'CONFIRMED', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    return { label: 'PENDING PAYMENT', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  };

  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const totalItems = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const paymentBadge = getPaymentBadge();

  return (
    <Card className="p-6 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          {/* Order Header */}
          <div className="flex items-center justify-between mb-3 gap-2">
            <div>
              <h3 className="text-lg font-bold">Order #{order.order_number}</h3>
              <p className="text-sm text-gray-500">{formatDate(order.order_time)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`px-3 py-1 text-xs border ${getStatusColor(order.status)}`}>
                <div className="flex items-center gap-1">
                  {getStatusIcon(order.status)}
                  {order.status.replace('_', ' ').toUpperCase()}
                </div>
              </Badge>
              <Badge className={`px-3 py-1 text-xs border ${paymentBadge.cls}`}>
                {paymentBadge.label}
              </Badge>
            </div>
          </div>

          {/* Order Items Preview */}
          <div className="flex gap-3 mb-4">
            {/* Product Image */}
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
              {orderItems[0]?.products?.image_url ? (
                <img 
                  src={orderItems[0].products.image_url} 
                  alt={orderItems[0].product_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-6 h-6 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1">
              <h4 className="font-semibold mb-1">
                {orderItems[0]?.product_name || 'Order Items'}
              </h4>
              <p className="text-sm text-gray-500 mb-2">
                {totalItems} item{totalItems !== 1 ? 's' : ''} 
                {orderItems.length > 1 && ` (+ ${orderItems.length - 1} more)`}
              </p>
              
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-lg font-bold text-primary block">
                    ₦{(order.total_amount || 0).toLocaleString()}
                  </span>
                  {(order.paid_at || paid) && (
                    <span className="text-xs text-gray-500">Paid at {formatDate(order.paid_at || '')}</span>
                  )}
                </div>
                {paid && (
                  <Badge className="px-2 py-0.5 text-xs border bg-green-100 text-green-800 border-green-200">
                    Paid
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Progress Tracking */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Order Progress</span>
              <div className="flex items-center gap-1 text-primary">
                <Clock className="w-4 h-4" />
                <span>
                  {order.status === 'delivered' ? 'Delivered' : 'In Progress'}
                </span>
              </div>
            </div>
            
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: getProgressWidth(order.status) }}
                ></div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Placed</span>
                <span>Processing</span>
                <span>Shipped</span>
                <span>Delivered</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
        <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${order.id}`)}>
          View Details
        </Button>
        <div className="flex gap-2">
          {order.status !== 'delivered' && order.status !== 'completed' && (
            <Button variant="ghost" size="sm" className="text-primary">
              Track Order <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {(order.status === 'delivered' || order.status === 'completed') && (
            <Button variant="ghost" size="sm" className="text-primary">
              Reorder <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
});

OrderCard.displayName = 'OrderCard';