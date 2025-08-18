import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Package, 
  MapPin, 
  Clock, 
  CreditCard, 
  Phone, 
  Mail,
  User,
  CheckCircle,
  AlertCircle,
  Truck,
  Calendar
} from 'lucide-react';
import { formatCurrency } from '@/lib/vatCalculations';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  customizations?: any;
}

interface PaymentTransaction {
  id: string;
  reference: string;
  amount: number;
  status: string;
  gateway_response: any;
  created_at: string;
  paid_at?: string;
}

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  phone?: string;
  is_active: boolean;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  paid_at?: string;
  total_amount: number;
  order_time: string;
  customer_id: string;
  customer_email: string;
  customer_phone?: string;
  payment_method?: string;
  payment_reference?: string;
  order_type: string;
  delivery_address?: any;
  pickup_point_id?: string | null;
  special_instructions?: string | null;
  estimated_delivery_date?: string | null;
}

const OrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [paymentTransaction, setPaymentTransaction] = useState<PaymentTransaction | null>(null);
  const [currentPickupPoint, setCurrentPickupPoint] = useState<PickupPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrderDetails = async () => {
    if (!id) return;

    try {
      setIsLoading(true);

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, paid_at, total_amount, order_time,
          customer_id, customer_email, customer_phone, payment_method, payment_reference,
          order_type, delivery_address, pickup_point_id, special_instructions,
          estimated_delivery_date
        `)
        .eq('id', id)
        .single();

      if (orderError) {
        console.error('Error fetching order:', orderError);
        toast({
          title: "Error",
          description: "Failed to load order details",
          variant: "destructive"
        });
        return;
      }

      setOrder(orderData);

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id);

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
      } else {
        setOrderItems(itemsData || []);
      }

      // Fetch payment transaction if payment reference exists
      if (orderData.payment_reference) {
        const { data: txData, error: txError } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('reference', orderData.payment_reference)
          .single();

        if (txError) {
          console.error('Error fetching payment transaction:', txError);
        } else {
          setPaymentTransaction(txData);
        }
      }

      // Fetch pickup point details if it's a pickup order
      if (orderData.order_type === 'pickup' && orderData.pickup_point_id) {
        const { data: pickupData, error: pickupError } = await supabase
          .from('pickup_points')
          .select('*')
          .eq('id', orderData.pickup_point_id)
          .single();

        if (pickupError) {
          console.error('Error fetching pickup point:', pickupError);
        } else {
          setCurrentPickupPoint(pickupData);
        }
      }

    } catch (error) {
      console.error('Error in fetchOrderDetails:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'ready':
      case 'ready_for_pickup':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'out_for_delivery':
      case 'shipped':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Order Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The order you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
  const tax = order.total_amount - subtotal;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Order Details</h1>
              <p className="text-muted-foreground">#{order.order_number}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className={`${getStatusColor(order.status)} border`}>
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge className={`${getPaymentStatusColor(order.payment_status)} border`}>
              {order.payment_status.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{item.product_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                        {item.customizations && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">Customizations:</p>
                            <pre className="text-xs bg-muted p-2 rounded mt-1">
                              {JSON.stringify(item.customizations, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.total_price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Delivery/Pickup Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {order.order_type === 'delivery' ? (
                    <>
                      <Truck className="h-5 w-5" />
                      Delivery Information
                    </>
                  ) : (
                    <>
                      <MapPin className="h-5 w-5" />
                      Pickup Information
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.order_type === 'delivery' && order.delivery_address && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Delivery Address</p>
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap">
                        {typeof order.delivery_address === 'string' 
                          ? order.delivery_address 
                          : JSON.stringify(order.delivery_address, null, 2)
                        }
                      </pre>
                    </div>
                  </div>
                )}

                {order.order_type === 'pickup' && currentPickupPoint && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Pickup Location</p>
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium">{currentPickupPoint.name}</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-4 w-4" />
                        {currentPickupPoint.address}
                      </p>
                      {currentPickupPoint.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="h-4 w-4" />
                          {currentPickupPoint.phone}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {order.estimated_delivery_date && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Estimated Delivery</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      {formatDate(order.estimated_delivery_date)}
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
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Tax & Fees</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{order.customer_email}</span>
                </div>
                {order.customer_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{order.customer_phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Order Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Order Placed</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(order.order_time)}
                    </p>
                  </div>
                </div>

                {(order.payment_status === 'paid' || paymentTransaction) && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Payment Confirmed</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(order.paid_at || paymentTransaction?.paid_at || order.order_time)}
                      </p>
                    </div>
                  </div>
                )}
                
                {order.status?.toLowerCase() === 'confirmed' && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Order Confirmed</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(order.paid_at || order.order_time)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
