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
    return <div className="text-muted-foreground">No items</div>;
  }

  return (
    <table className="w-full text-sm border rounded">
      <thead>
        <tr className="font-bold">
          <th className="text-left py-2">Item</th>
          <th className="text-right py-2">Qty</th>
          <th className="text-right py-2">Price</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td className="py-2">{item.name}</td>
            <td className="py-2 text-right">{item.quantity}</td>
            <td className="py-2 text-right">₦{item.price?.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};