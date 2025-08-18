import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, DollarSign, User, Phone, Mail, Calendar, Package, CreditCard, AlertCircle, CheckCircle, Truck, FileText, Receipt } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/vatCalculations';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  estimated_delivery_time?: string;
  special_instructions?: string;
  order_items: OrderItem[];
}

interface PaymentTransaction {
  id: string;
  reference: string;
  transaction_id: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  customer_email: string;
  customer_name: string;
  created_at: string;
}

const OrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentTransaction, setPaymentTransaction] = useState<PaymentTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchOrderDetails(id);
    }
  }, [id]);

  const fetchOrderDetails = async (orderId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch order details with items
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price,
            total_price,
            special_instructions,
            menu_items (name)
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) {
        throw new Error(orderError.message);
      }

      if (!orderData) {
        throw new Error('Order not found');
      }

      // Transform the data to match our interface
      const transformedOrder: Order = {
        ...orderData,
        delivery_address: typeof orderData.delivery_address === 'string' 
          ? orderData.delivery_address 
          : JSON.stringify(orderData.delivery_address),
        order_items: orderData.order_items.map((item: any) => ({
          id: item.id,
          name: item.menu_items?.name || 'Unknown Item',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          special_instructions: item.special_instructions
        }))
      };

      setOrder(transformedOrder);

      // Fetch payment transaction if exists
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (paymentData && !paymentError) {
        // Transform payment data to match our interface
        const transformedPayment: PaymentTransaction = {
          id: paymentData.id,
          reference: paymentData.paystack_reference || paymentData.id,
          transaction_id: paymentData.paystack_transaction_id || paymentData.id,
          amount: paymentData.amount,
          currency: paymentData.currency,
          status: paymentData.status,
          gateway: paymentData.payment_method || 'paystack',
          customer_email: paymentData.customer_email,
          customer_name: paymentData.customer_name,
          created_at: paymentData.created_at
        };
        
        setPaymentTransaction(transformedPayment);
      }

    } catch (err) {
      console.error('Error fetching order details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch order details');
      toast({
        title: "Error",
        description: "Failed to load order details. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'ready':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'out_for_delivery':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'preparing':
        return <Package className="h-4 w-4" />;
      case 'ready':
        return <CheckCircle className="h-4 w-4" />;
      case 'out_for_delivery':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4" />;
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <Skeleton className="h-10 w-32 mb-4" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
            <p className="text-muted-foreground">{error || 'The requested order could not be found.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Order #{order.order_number}</h1>
        <p className="text-muted-foreground">Order placed on {formatDate(order.created_at)}</p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Order Status</p>
                <Badge className={`mt-1 ${getStatusColor(order.order_status)}`}>
                  {getStatusIcon(order.order_status)}
                  <span className="ml-1 capitalize">{order.order_status.replace('_', ' ')}</span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                <Badge className={`mt-1 ${getStatusColor(order.payment_status)}`}>
                  {getStatusIcon(order.payment_status)}
                  <span className="ml-1 capitalize">{order.payment_status}</span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{order.customer_name}</span>
            </div>
            <div className="flex items-center">
              <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{order.customer_email}</span>
            </div>
            <div className="flex items-center">
              <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{order.customer_phone}</span>
            </div>
            <div className="flex items-start">
              <MapPin className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
              <span className="text-sm">{order.delivery_address}</span>
            </div>
            {order.estimated_delivery_time && (
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-sm">Est. Delivery: {formatDate(order.estimated_delivery_time)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Order Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    {item.special_instructions && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Note: {item.special_instructions}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(item.total_price)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(item.unit_price)} each
                    </p>
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="flex justify-between items-center font-bold">
                <span>Total</span>
                <span className="text-lg">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Information */}
      {paymentTransaction && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Transaction ID</p>
                <p className="text-sm font-mono">{paymentTransaction.transaction_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reference</p>
                <p className="text-sm font-mono">{paymentTransaction.reference}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Amount</p>
                <p className="text-sm">{formatCurrency(paymentTransaction.amount)} {paymentTransaction.currency}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gateway</p>
                <p className="text-sm capitalize">{paymentTransaction.gateway}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payment Date</p>
                <p className="text-sm">{formatDate(paymentTransaction.created_at)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge className={`${getStatusColor(paymentTransaction.status)}`}>
                  {getStatusIcon(paymentTransaction.status)}
                  <span className="ml-1 capitalize">{paymentTransaction.status}</span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Special Instructions */}
      {order.special_instructions && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Special Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{order.special_instructions}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrderDetails;
