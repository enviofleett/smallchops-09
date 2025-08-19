import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

interface OrderSummaryCardProps {
  items: CartItem[];
  subtotal: number; // subtotal incl. VAT
  deliveryFee: number;
  total: number;
  vatAmount?: number;
  subTotalExVat?: number;
  subTotalInclVat?: number;
  sticky?: boolean;
  collapsibleOnMobile?: boolean;
  className?: string;
}

export const OrderSummaryCard: React.FC<OrderSummaryCardProps> = ({
  items,
  subtotal,
  deliveryFee,
  total,
  vatAmount,
  subTotalExVat,
  subTotalInclVat,
  sticky = false,
  collapsibleOnMobile = false,
  className
}) => {
  const orderContent = (
    <div className="space-y-4">
      {/* Items List */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight truncate">
                {item.product_name}
              </p>
              <p className="text-xs text-muted-foreground">
                Qty: {item.quantity}
              </p>
            </div>
            <p className="text-sm font-medium shrink-0">
              ₦{(item.price * item.quantity).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <Separator />

      {/* Totals */}
      <div className="space-y-2">
        {/* VAT-aware breakdown */}
        <div className="flex items-center justify-between text-sm">
          <span>Sub Total (excl. VAT)</span>
          <span>₦{(subTotalExVat ?? (subtotal - (vatAmount ?? 0))).toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>VAT</span>
          <span>₦{(vatAmount ?? 0).toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between text-sm font-medium">
          <span>Sub Total (incl. VAT)</span>
          <span>₦{(subTotalInclVat ?? subtotal).toLocaleString()}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span>Delivery Fee</span>
          <span>{deliveryFee > 0 ? `₦${deliveryFee.toLocaleString()}` : '₦0'}</span>
        </div>
        
        <Separator />
        
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <span className="text-lg">₦{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );

  // Mobile: Collapsible version
  if (collapsibleOnMobile) {
    return (
      <div className={cn("lg:hidden", className)}>
        <Accordion type="single" collapsible defaultValue="order-summary">
          <AccordionItem value="order-summary" className="border border-border rounded-lg shadow-sm bg-card">
            <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-muted/50 transition-colors [&>svg]:h-4 [&>svg]:w-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-base">Order Summary</p>
                    <p className="text-sm text-muted-foreground">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-primary">₦{total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-0">
              <div className="pt-2 border-t">
                {orderContent}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  // Desktop: Regular card
  return (
    <Card className={cn(
      "hidden lg:block shadow-sm",
      sticky && "sticky top-6",
      className
    )}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingCart className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Order Summary</p>
            <p className="text-sm font-normal text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {orderContent}
      </CardContent>
    </Card>
  );
};