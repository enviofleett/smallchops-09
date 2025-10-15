import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Info } from 'lucide-react';
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
  // Paystack will add their own fees at checkout
  const finalTotal = subtotal + deliveryFee;

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
        <div className="flex items-center justify-between text-sm">
          <span>Subtotal (incl. VAT)</span>
          <span>₦{(subTotalInclVat ?? subtotal).toLocaleString()}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span>Delivery Fee</span>
          <span>{deliveryFee > 0 ? `₦${deliveryFee.toLocaleString()}` : 'Free'}</span>
        </div>
        
        <Separator />
        
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <span className="text-lg text-primary">₦{finalTotal.toLocaleString()}</span>
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md mt-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800 dark:text-blue-300">
            Payment processing fees will be calculated and added by Paystack at checkout
          </p>
        </div>
      </div>
    </div>
  );

  // Mobile: Collapsible version
  if (collapsibleOnMobile) {
    return (
      <div className={cn("md:hidden mb-6", className)}>
        <Accordion type="single" collapsible>
          <AccordionItem value="order-summary" className="border border-border rounded-lg shadow-sm">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  <span className="font-medium">Order Summary</span>
                  <span className="text-sm text-muted-foreground">
                    ({items.length} {items.length === 1 ? 'item' : 'items'})
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary">₦{finalTotal.toLocaleString()}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2">
              {orderContent}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  // Desktop: Regular card
  return (
    <Card className={cn(
      "hidden md:block",
      sticky && "sticky top-4",
      className
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="h-5 w-5" />
          Order Summary
          <span className="text-sm font-normal text-muted-foreground">
            ({items.length} items)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orderContent}
      </CardContent>
    </Card>
  );
};