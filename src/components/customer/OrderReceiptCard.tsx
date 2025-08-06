import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Receipt, 
  Download, 
  Mail, 
  Building2, 
  Calendar,
  Hash,
  User,
  Phone,
  MapPin,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { formatAddress } from '@/utils/formatAddress';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderReceiptProps {
  order: {
    id: string;
    order_number: string;
    order_time: string;
    total_amount: number;
    delivery_fee?: number;
    vat_amount?: number;
    subtotal?: number;
    customer_name: string;
    customer_email: string;
    customer_phone?: string;
    delivery_address?: string;
    payment_status?: string;
    payment_method?: string;
    order_items: OrderItem[];
  };
  businessInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  onDownload?: () => void;
  onEmailReceipt?: () => void;
}

export function OrderReceiptCard({ 
  order, 
  businessInfo, 
  onDownload, 
  onEmailReceipt 
}: OrderReceiptProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const subtotal = order.subtotal || order.order_items.reduce((sum, item) => sum + item.total_price, 0);
  const deliveryFee = order.delivery_fee || 0;
  const vatAmount = order.vat_amount || 0;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        {/* Receipt Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Receipt className="w-8 h-8 text-primary" />
            <h2 className="text-2xl font-bold">Order Receipt</h2>
          </div>
          
          {/* Business Information */}
          {businessInfo && (
            <div className="text-sm text-muted-foreground space-y-1 mb-4">
              <p className="font-semibold text-foreground">{businessInfo.name}</p>
              <p>{businessInfo.address}</p>
              <p>Phone: {businessInfo.phone} | Email: {businessInfo.email}</p>
            </div>
          )}
          
          {/* Order ID and Date */}
          <div className="bg-primary/10 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Hash className="w-5 h-5 text-primary" />
              <span className="text-lg font-bold text-primary">
                Order ID: {order.order_number}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(order.order_time), 'PPP p')}</span>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Details
            </h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Name:</span> {order.customer_name}</p>
              <p><span className="font-medium">Email:</span> {order.customer_email}</p>
              {order.customer_phone && (
                <p><span className="font-medium">Phone:</span> {order.customer_phone}</p>
              )}
            </div>
          </div>
          
          {order.delivery_address && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Address
              </h3>
              <p className="text-sm">{formatAddress(order.delivery_address)}</p>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* Order Items */}
        <div className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Order Items
          </h3>
          <div className="space-y-3">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between items-center">
                <div className="flex-1">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <div className="text-right font-medium">
                  {formatCurrency(item.total_price)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Order Summary */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          
          {deliveryFee > 0 && (
            <div className="flex justify-between">
              <span>Delivery Fee:</span>
              <span>{formatCurrency(deliveryFee)}</span>
            </div>
          )}
          
          {vatAmount > 0 && (
            <div className="flex justify-between">
              <span>VAT (7.5%):</span>
              <span>{formatCurrency(vatAmount)}</span>
            </div>
          )}
          
          <Separator />
          
          <div className="flex justify-between text-lg font-bold">
            <span>Total Amount:</span>
            <span>{formatCurrency(order.total_amount)}</span>
          </div>
          
          {/* Payment Information */}
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 mt-4">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Payment Status: {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
            </p>
            {order.payment_method && (
              <p className="text-sm text-green-700 dark:text-green-300">
                Payment Method: {order.payment_method}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          {onDownload && (
            <Button variant="outline" onClick={onDownload} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download Receipt
            </Button>
          )}
          
          {onEmailReceipt && (
            <Button variant="outline" onClick={onEmailReceipt} className="flex-1">
              <Mail className="w-4 h-4 mr-2" />
              Email Receipt
            </Button>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6 pt-4 border-t text-xs text-muted-foreground">
          <p>Thank you for your order! Keep this receipt for your records.</p>
          <p className="mt-1">Order ID: {order.order_number}</p>
        </div>
      </CardContent>
    </Card>
  );
}