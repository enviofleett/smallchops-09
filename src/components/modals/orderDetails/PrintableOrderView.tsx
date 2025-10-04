import React from 'react';
import { Order } from '@/types/orderDetailsModal';
import { formatAddress } from '@/utils/formatAddress';

interface PrintableOrderViewProps {
  order: Order | null;
}

export const PrintableOrderView: React.FC<PrintableOrderViewProps> = ({ order }) => {
  if (!order) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateSubtotal = () => {
    return order.items.reduce((sum, item) => sum + item.total_price, 0);
  };

  return (
    <div className="print-only hidden print:block bg-white text-black p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
          <h1 className="text-3xl font-bold mb-2">Order Details</h1>
          <h2 className="text-xl text-gray-600">Order #{order.order_number}</h2>
        </div>

        {/* Order Information */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-2">
              Customer Information
            </h3>
            <div className="space-y-2">
              <p><strong>Name:</strong> {order.customer_name || 'N/A'}</p>
              <p><strong>Email:</strong> {order.customer_email || 'N/A'}</p>
              <p><strong>Phone:</strong> {order.customer_phone || 'N/A'}</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-2">
              Order Information
            </h3>
            <div className="space-y-2">
              <p><strong>Order Type:</strong> {order.order_type}</p>
              <p><strong>Status:</strong> {order.status}</p>
              <p><strong>Payment Status:</strong> {order.payment_status}</p>
              <p><strong>Created:</strong> {formatDateTime(order.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-2">
            Order Items
          </h3>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Item</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Qty</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Unit Price</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={item.id || index}>
                  <td className="border border-gray-300 px-4 py-2">
                    <div>
                      <div className="font-medium">
                        {item.product_name || item.name || item.product?.name || 'Unknown Item'}
                      </div>
                      {item.special_instructions && (
                        <div className="text-sm text-gray-600 italic">
                          Note: {item.special_instructions}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {item.quantity}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-right">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-right">
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>{formatCurrency(calculateSubtotal())}</span>
              </div>
              
              {order.vat_amount && order.vat_amount > 0 && (
                <div className="flex justify-between py-1">
                  <span>VAT ({order.vat_rate || 7.5}%):</span>
                  <span>{formatCurrency(order.vat_amount)}</span>
                </div>
              )}

              {order.delivery_fee && order.delivery_fee > 0 && (
                <div className="flex justify-between py-1">
                  <span>Delivery Fee:</span>
                  <span>{formatCurrency(order.delivery_fee)}</span>
                </div>
              )}

              {order.discount_amount && order.discount_amount > 0 && (
                <div className="flex justify-between py-1">
                  <span>Discount:</span>
                  <span>-{formatCurrency(order.discount_amount)}</span>
                </div>
              )}

              <div className="flex justify-between py-2 border-t-2 border-gray-300 font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery/Pickup Information */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-2">
            {order.order_type === 'delivery' ? 'Delivery Information' : 'Pickup Information'}
          </h3>
          <div className="space-y-2">
            {order.order_type === 'delivery' && order.delivery_address && (
              <p><strong>Address:</strong> {formatAddress(order.delivery_address)}</p>
            )}
            {order.pickup_time && (
              <p><strong>Pickup Time:</strong> {formatDateTime(order.pickup_time)}</p>
            )}
            {order.special_instructions && (
              <p><strong>Special Instructions:</strong> {order.special_instructions}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 border-t border-gray-200 pt-4">
          <p>Printed on {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};