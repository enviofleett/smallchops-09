import React from 'react';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Package,
  User,
  MapPin,
  Clock,
  Phone,
  Mail,
  Truck,
  CheckCircle,
  Printer
} from 'lucide-react';

interface NewOrderDetailsModalProps {
  open: boolean;
  onClose: () => void;
  order?: any; // For compatibility, but we'll use mock data
}

// Mock order data - this will be consistent across all usages
const mockOrderData = {
  id: 'order_123456',
  order_number: 'SC-2024-001',
  status: 'preparing',
  order_type: 'delivery',
  customer_name: 'John Doe',
  customer_email: 'john.doe@example.com',
  customer_phone: '+234 812 345 6789',
  payment_status: 'paid',
  payment_reference: 'PAY_REF_123456789',
  total_amount: 15500,
  delivery_fee: 2000,
  subtotal: 13500,
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-01-15T11:15:00Z',
  items: [
    {
      id: 'item_1',
      product: {
        name: 'Beef Samosa (6 pieces)',
        image_url: '/placeholder.svg'
      },
      quantity: 2,
      unit_price: 3500,
      total_price: 7000
    },
    {
      id: 'item_2',
      product: {
        name: 'Chicken Spring Rolls (4 pieces)',
        image_url: '/placeholder.svg'
      },
      quantity: 1,
      unit_price: 2500,
      total_price: 2500
    },
    {
      id: 'item_3',
      product: {
        name: 'Mixed Fruit Platter',
        image_url: '/placeholder.svg'
      },
      quantity: 1,
      unit_price: 4000,
      total_price: 4000
    }
  ],
  fulfillment_info: {
    address: '123 Victoria Island, Lagos, Nigeria',
    delivery_date: '2024-01-15',
    delivery_hours: {
      start: '12:00',
      end: '14:00'
    },
    special_instructions: 'Please call when you arrive at the gate'
  }
};

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
  order // This prop exists for compatibility but we use mock data
}) => {
  const orderData = mockOrderData; // Always use mock data

  const handlePrint = () => {
    window.print();
  };

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onClose}
      size="lg"
      title={`Order #${orderData.order_number}`}
      description="Order details (Mock Data)"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">#{orderData.order_number}</CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${STATUS_COLORS[orderData.status as keyof typeof STATUS_COLORS]} text-white`}>
                    {orderData.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    {orderData.order_type.toUpperCase()}
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    MOCK DATA
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4" />
                <span className="sr-only">Print order</span>
              </Button>
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
                <p className="text-sm">{orderData.customer_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="text-sm">Guest Customer</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </p>
              <p className="text-sm break-all">{orderData.customer_email}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone
              </p>
              <p className="text-sm">{orderData.customer_phone}</p>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                <Badge 
                  variant="secondary" 
                  className="ml-2 bg-green-100 text-green-800"
                >
                  {orderData.payment_status.toUpperCase()}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Payment Reference</p>
                <p className="text-sm font-mono break-all">{orderData.payment_reference}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Items ({orderData.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orderData.items.map((item, index) => (
                <div key={item.id || index} className="flex items-center gap-4 p-4 border rounded-lg">
                  {item.product?.image_url && (
                    <img 
                      src={item.product.image_url} 
                      alt={item.product.name || 'Product'}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{item.product?.name || 'Product'}</h4>
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-medium">{formatCurrency(item.total_price)}</p>
                  </div>
                </div>
              ))}
              
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(orderData.subtotal)}</span>
                </div>
                
                {orderData.order_type === 'delivery' && orderData.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span>{formatCurrency(orderData.delivery_fee)}</span>
                  </div>
                )}
                
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(orderData.total_amount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Information */}
        {orderData.order_type === 'delivery' && orderData.fulfillment_info && (
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
                  {orderData.fulfillment_info.delivery_date && orderData.fulfillment_info.delivery_hours 
                    ? `${orderData.fulfillment_info.delivery_date} ${orderData.fulfillment_info.delivery_hours.start} - ${orderData.fulfillment_info.delivery_hours.end}`
                    : 'To be scheduled'
                  }
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address
                </p>
                <p className="text-sm break-words">{orderData.fulfillment_info.address}</p>
              </div>
              
              {orderData.fulfillment_info.special_instructions && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Special Instructions</p>
                  <p className="text-sm break-words">{orderData.fulfillment_info.special_instructions}</p>
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
              Order Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Order Confirmed</p>
                  <p className="text-xs text-muted-foreground">January 15, 2024 at 10:30 AM</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Currently Preparing</p>
                  <p className="text-xs text-muted-foreground">January 15, 2024 at 11:00 AM</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Ready for Delivery</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Delivered</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Created: {new Date(orderData.created_at).toLocaleString()}</p>
              <p>Last Updated: {new Date(orderData.updated_at).toLocaleString()}</p>
              <p>Order ID: {orderData.id}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdaptiveDialog>
  );
};