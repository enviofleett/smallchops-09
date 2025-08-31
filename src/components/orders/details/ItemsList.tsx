import React from 'react';
import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from './SectionHeading';
import { OrderItemsBreakdown } from '../OrderItemsBreakdown';

interface ItemsListProps {
  items: any[];
  subtotal?: number;
  totalVat?: number;
  totalDiscount?: number;
  deliveryFee?: number;
  grandTotal: number;
}

export const ItemsList: React.FC<ItemsListProps> = ({
  items,
  subtotal = 0,
  totalVat = 0,
  totalDiscount = 0,
  deliveryFee = 0,
  grandTotal
}) => {
  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <SectionHeading 
            title="Order Items" 
            icon={Package} 
          />
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No items found for this order</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <SectionHeading 
          title="Order Items" 
          icon={Package} 
        />
        
        <OrderItemsBreakdown 
          items={items}
          subtotal={subtotal}
          totalVat={totalVat}
          totalDiscount={totalDiscount}
          deliveryFee={deliveryFee}
          grandTotal={grandTotal}
          showDetailed={true}
        />
      </CardContent>
    </Card>
  );
};