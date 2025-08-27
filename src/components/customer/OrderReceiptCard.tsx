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
  Clock,
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
        {/* Receipt Header with Logo */}
        <div className="text-center mb-6 border-b pb-6">
          {/* Logo and Business Name */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">S</span>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-primary">Starters</h1>
              <p className="text-sm text-muted-foreground">Small Chops & Catering</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-4">
            <Receipt className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Official Receipt</h2>
          </div>
          
          {/* Business Information */}
          {businessInfo && (
            <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2 mb-4">
              <p className="font-semibold text-foreground text-lg">{businessInfo.name}</p>
              <div className="flex items-center justify-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{businessInfo.address}</span>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>{businessInfo.phone}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  <span>{businessInfo.email}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Order ID and Date - Enhanced */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Hash className="w-5 h-5 text-primary" />
              <span className="text-lg font-bold text-primary">
                Receipt #{order.order_number}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{format(new Date(order.order_time), 'PPP')}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{format(new Date(order.order_time), 'p')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Customer & Delivery Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-muted/20 rounded-lg p-4 border">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-primary">
              <User className="w-5 h-5" />
              Customer Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">Customer</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-all">{order.customer_email}</p>
                  <p className="text-xs text-muted-foreground">Email Address</p>
                </div>
              </div>

              {order.customer_phone && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Phone className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{order.customer_phone}</p>
                    <p className="text-xs text-muted-foreground">Phone Number</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {order.delivery_address && (
            <div className="bg-muted/20 rounded-lg p-4 border">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-secondary-foreground">
                <MapPin className="w-5 h-5" />
                Delivery Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center mt-1">
                    <MapPin className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-relaxed">{formatAddress(order.delivery_address)}</p>
                    <p className="text-xs text-muted-foreground">Delivery Address</p>
                  </div>
                </div>
                
                {deliveryFee > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-orange-700">₦</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-700">{formatCurrency(deliveryFee)}</p>
                      <p className="text-xs text-muted-foreground">Delivery Fee</p>
                    </div>
                  </div>
                )}
              </div>
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

        {/* Enhanced Order Summary */}
        <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg p-4 border">
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Subtotal (Items):</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            
            {deliveryFee > 0 && (
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Delivery Fee:</span>
                <span className="font-semibold text-orange-600">{formatCurrency(deliveryFee)}</span>
              </div>
            )}
            
            {vatAmount > 0 && (
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">VAT (7.5%):</span>
                <span className="font-semibold">{formatCurrency(vatAmount)}</span>
              </div>
            )}
            
            <Separator className="my-3" />
            
            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-primary">Total Amount:</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
            
            {/* Enhanced Payment Information */}
            <div className={`rounded-lg p-4 mt-4 border ${
              order.payment_status === 'paid' 
                ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' 
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  order.payment_status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <p className={`font-semibold ${
                  order.payment_status === 'paid' 
                    ? 'text-green-800 dark:text-green-200' 
                    : 'text-yellow-800 dark:text-yellow-200'
                }`}>
                  Payment Status: {order.payment_status === 'paid' ? 'PAID ✓' : 'PENDING'}
                </p>
              </div>
              <p className={`text-sm ${
                order.payment_status === 'paid' 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-yellow-700 dark:text-yellow-300'
              }`}>
                Payment Method: {order.payment_status === 'paid' ? 'Paystack (Online)' : (order.payment_method || 'Online Payment')}
              </p>
              {order.payment_status === 'paid' && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Transaction completed successfully
                </p>
              )}
            </div>
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