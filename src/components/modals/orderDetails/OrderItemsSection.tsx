import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Order } from '@/types/orderDetailsModal';

interface OrderItemsSectionProps {
  order: Order;
}

export const OrderItemsSection: React.FC<OrderItemsSectionProps> = ({ order }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const calculateSubtotal = () => {
    return order.items.reduce((sum, item) => sum + item.total_price, 0);
  };

  return (
    <Card className="keep-together">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Order Items
          </div>
          <span className="text-sm font-normal text-muted-foreground">
            ({order.items.length} {order.items.length === 1 ? 'item' : 'items'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {order.items.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No items found
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={item.id || index} className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">
                      {item.product?.name || item.name || item.product_name || 'Unknown Item'}
                    </h4>
                    
                    {/* Product Description */}
                    {item.product?.description && (
                      <p className="text-sm text-muted-foreground mt-1" 
                         dangerouslySetInnerHTML={{ __html: item.product.description }} />
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Qty: {item.quantity}</span>
                      <span>×</span>
                      <span>{formatCurrency(item.unit_price)}</span>
                    </div>
                    
                    {/* Product Features */}
                    {item.product?.features && Array.isArray(item.product.features) && item.product.features.length > 0 && (
                      <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                        <span className="font-medium text-primary">What's included:</span>
                        <ul className="mt-1 space-y-0.5">
                          {item.product.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="text-muted-foreground">• {feature}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {item.special_instructions && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Note: {item.special_instructions}
                      </p>
                    )}
                    {item.customizations && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Customizations: {item.customizations}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium text-foreground">
                      {formatCurrency(item.total_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(calculateSubtotal())}
                </span>
              </div>

              {order.vat_amount && order.vat_amount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    VAT ({order.vat_rate || 7.5}%)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(order.vat_amount)}
                  </span>
                </div>
              )}

              {order.delivery_fee && order.delivery_fee > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span className="font-medium">
                    {formatCurrency(order.delivery_fee)}
                  </span>
                </div>
              )}

              {order.discount_amount && order.discount_amount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium text-success">
                    -{formatCurrency(order.discount_amount)}
                  </span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between items-center font-semibold">
                <span>Total</span>
                <span className="text-lg">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};