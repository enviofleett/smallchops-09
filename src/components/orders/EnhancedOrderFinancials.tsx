import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  Clock,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

interface OrderFinancialsProps {
  order: any;
  showInternalMetrics?: boolean;
}

export const EnhancedOrderFinancials: React.FC<OrderFinancialsProps> = ({ 
  order, 
  showInternalMetrics = false 
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Not available';
    return format(new Date(dateString), 'PPpp');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Payment Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Payment Status</span>
            <Badge 
              variant={order.payment_status === 'completed' ? 'default' : 'secondary'}
              className={order.payment_status === 'completed' ? 'bg-green-500' : ''}
            >
              {order.payment_status || 'pending'}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Payment Method</span>
            <span className="font-medium capitalize">
              {order.payment_method || 'Not specified'}
            </span>
          </div>

          {order.payment_reference && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Payment Reference</span>
              <span className="font-mono text-sm">{order.payment_reference}</span>
            </div>
          )}

          {order.paystack_reference && order.paystack_reference !== order.payment_reference && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Paystack Reference</span>
              <span className="font-mono text-sm">{order.paystack_reference}</span>
            </div>
          )}

          {order.paid_at && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Paid At</span>
              <span className="text-sm">{formatDateTime(order.paid_at)}</span>
            </div>
          )}

          {order.payment_verified_at && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Verified At</span>
              <span className="text-sm">{formatDateTime(order.payment_verified_at)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Financial Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(order.subtotal || 0)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Delivery Fee</span>
            <span className="font-medium">{formatCurrency(order.delivery_fee || 0)}</span>
          </div>
          
          {order.discount_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Discount</span>
              <span className="font-medium text-green-600">
                -{formatCurrency(order.discount_amount)}
              </span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">VAT</span>
            <span className="font-medium">{formatCurrency(order.total_vat || order.vat_amount || order.tax_amount || 0)}</span>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex justify-between">
              <span className="font-semibold">Total Amount</span>
              <span className="font-bold text-lg">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>

          {/* Internal Cost Metrics (Admin Only) */}
          {showInternalMetrics && (
            <>
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Internal Metrics
                </h4>
                
                {order.subtotal_cost !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cost of Goods</span>
                    <span className="font-medium">{formatCurrency(order.subtotal_cost)}</span>
                  </div>
                )}
                
                {order.subtotal_cost !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Gross Profit</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency((order.subtotal || 0) - (order.subtotal_cost || 0))}
                    </span>
                  </div>
                )}
                
                {order.subtotal_cost !== undefined && order.subtotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Profit Margin</span>
                    <span className="font-medium">
                      {(((order.subtotal - order.subtotal_cost) / order.subtotal) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Processing Information */}
      {(order.processing_lock || order.processing_officer_name || order.processing_started_at) && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Processing Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {order.processing_lock && (
              <div>
                <p className="text-sm text-muted-foreground">Processing Status</p>
                <Badge variant="destructive">
                  🔒 Locked for Processing
                </Badge>
              </div>
            )}
            
            {order.processing_officer_name && (
              <div>
                <p className="text-sm text-muted-foreground">Processing Officer</p>
                <p className="font-medium">{order.processing_officer_name}</p>
              </div>
            )}
            
            {order.processing_started_at && (
              <div>
                <p className="text-sm text-muted-foreground">Processing Started</p>
                <p className="font-medium">{formatDateTime(order.processing_started_at)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

        {/* Order Metadata */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Order Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Order Time</p>
              <p className="font-medium">{formatDateTime(order.order_time || order.created_at)}</p>
            </div>
            
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="font-medium">{formatDateTime(order.updated_at)}</p>
            </div>

            {order.paid_at && (
              <div>
                <p className="text-muted-foreground">Paid At</p>
                <p className="font-medium text-green-600">{formatDateTime(order.paid_at)}</p>
              </div>
            )}

            {order.payment_verified_at && (
              <div>
                <p className="text-muted-foreground">Payment Verified</p>
                <p className="font-medium text-green-600">{formatDateTime(order.payment_verified_at)}</p>
              </div>
            )}

            {order.processing_started_at && (
              <div>
                <p className="text-muted-foreground">Processing Started</p>
                <p className="font-medium">{formatDateTime(order.processing_started_at)}</p>
              </div>
            )}
            
            {showInternalMetrics && (
              <>
                {order.guest_session_id && (
                  <div>
                    <p className="text-muted-foreground">Guest Session</p>
                    <p className="font-mono text-xs">{order.guest_session_id.slice(-8)}</p>
                  </div>
                )}
                
                {order.idempotency_key && (
                  <div>
                    <p className="text-muted-foreground">Idempotency Key</p>
                    <p className="font-mono text-xs">{order.idempotency_key.slice(-8)}</p>
                  </div>
                )}

                {order.paystack_reference && (
                  <div>
                    <p className="text-muted-foreground">Paystack Ref</p>
                    <p className="font-mono text-xs">{order.paystack_reference}</p>
                  </div>
                )}

                {order.reference_updated_at && (
                  <div>
                    <p className="text-muted-foreground">Reference Updated</p>
                    <p className="font-medium">{formatDateTime(order.reference_updated_at)}</p>
                  </div>
                )}
              </>
            )}
            
            {order.estimated_delivery_date && (
              <div>
                <p className="text-muted-foreground">Est. Delivery</p>
                <p className="font-medium">{formatDateTime(order.estimated_delivery_date)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};