import React from 'react';

interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
}

interface OrderItemsTableProps {
  items: OrderItem[];
}

/**
 * OrderItemsTable component displays order items in a table format
 * 
 * @param items - Array of order items with name, quantity, and price
 * 
 * @example
 * ```tsx
 * const items = [
 *   { name: "Meat Pie", quantity: 2, price: 400 },
 *   { name: "Chicken Roll", quantity: 1, price: 350 },
 *   { name: "Fish Roll", quantity: 3, price: 300 }
 * ];
 * 
 * <OrderItemsTable items={items} />
 * ```
 */
export const OrderItemsTable: React.FC<OrderItemsTableProps> = ({ items }) => {
  if (!items.length) {
    return <div className="text-sm text-muted-foreground">No items</div>;
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Item</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qty</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">{item.name}</td>
              <td className="px-4 py-3 text-right">{item.quantity}</td>
              <td className="px-4 py-3 text-right font-medium">₦{item.price?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};