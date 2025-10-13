import { UnifiedOrder } from '@/types/unifiedOrder';
import { format } from 'date-fns';
import { formatAddress } from '@/utils/formatAddress';
import { getOrderTimeWindow, formatDeliveryDate } from '@/utils/timeWindowUtils';

interface CustomerOrderPDFProps {
  order: UnifiedOrder;
  businessSettings?: any;
  deliveryZone?: any;
  pickupPoint?: any;
}

export const CustomerOrderPDF: React.FC<CustomerOrderPDFProps> = ({
  order,
  businessSettings,
  deliveryZone,
  pickupPoint
}) => {
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      ready: 'Ready',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      completed: 'Completed',
      refunded: 'Refunded',
      returned: 'Returned'
    };
    return labels[status] || status;
  };

  return (
    <div className="p-8 bg-white text-black max-w-4xl mx-auto">
      {/* Header with Logo */}
      <div className="border-b-4 border-primary pb-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            {businessSettings?.logo_url && (
              <img 
                src={businessSettings.logo_url} 
                alt={businessSettings?.name || 'Starters'} 
                className="h-16 w-auto mb-2"
              />
            )}
            <h1 className="text-3xl font-bold text-primary">
              {businessSettings?.name || 'Starters'}
            </h1>
            {businessSettings?.tagline && (
              <p className="text-sm text-gray-600 mt-1">{businessSettings.tagline}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">ORDER RECEIPT</div>
            <div className="text-sm text-gray-600 mt-1">
              {format(new Date(order.order_time), 'MMM dd, yyyy')}
            </div>
          </div>
        </div>
      </div>

      {/* Order Information */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-2">Order Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Order Number:</span>
              <span className="font-semibold">#{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Order Type:</span>
              <span className="font-semibold capitalize">{order.order_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-semibold">{getStatusLabel(order.status)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Status:</span>
              <span className="font-semibold capitalize">{order.payment_status}</span>
            </div>
            {order.payment_method && (
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-semibold capitalize">{order.payment_method}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-2">Customer Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-semibold">{order.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-semibold text-xs">{order.customer_email}</span>
            </div>
            {order.customer_phone && (
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-semibold">{order.customer_phone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delivery/Pickup Information */}
      {order.order_type === 'delivery' ? (
        <div className="mb-8">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-2 mb-3">Delivery Information</h2>
          <div className="space-y-2 text-sm">
            {order.delivery_address && (
              <div>
                <span className="text-gray-600 font-medium">Address: </span>
                <span>{formatAddress(order.delivery_address)}</span>
              </div>
            )}
            {order.delivery_date && formatDeliveryDate(order.delivery_date) && (
              <div>
                <span className="text-gray-600 font-medium">Delivery Date: </span>
                <span>{formatDeliveryDate(order.delivery_date)}</span>
              </div>
            )}
            {getOrderTimeWindow(order) && (
              <div>
                <span className="text-gray-600 font-medium">Delivery Time: </span>
                <span>{getOrderTimeWindow(order)}</span>
              </div>
            )}
            {deliveryZone && (
              <div>
                <span className="text-gray-600 font-medium">Delivery Zone: </span>
                <span>{deliveryZone.name}</span>
              </div>
            )}
          </div>
        </div>
      ) : order.order_type === 'pickup' && pickupPoint ? (
        <div className="mb-8">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-2 mb-3">Pickup Information</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600 font-medium">Location: </span>
              <span className="font-semibold">{pickupPoint.name}</span>
            </div>
            <div>
              <span className="text-gray-600 font-medium">Address: </span>
              <span>{pickupPoint.address}</span>
            </div>
            {getOrderTimeWindow(order) && (
              <div>
                <span className="text-gray-600 font-medium">Pickup Time: </span>
                <span>{getOrderTimeWindow(order)}</span>
              </div>
            )}
            {pickupPoint.contact_phone && (
              <div>
                <span className="text-gray-600 font-medium">Contact: </span>
                <span>{pickupPoint.contact_phone}</span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Order Items */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold border-b border-gray-300 pb-2 mb-4">Order Items</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-3 font-semibold">Item</th>
              <th className="text-center p-3 font-semibold">Qty</th>
              <th className="text-right p-3 font-semibold">Unit Price</th>
              <th className="text-right p-3 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="p-3">
                  <div className="font-medium">{item.product?.name || item.product_name}</div>
                  {item.special_instructions && (
                    <div className="text-xs text-gray-600 italic mt-1">
                      Note: {item.special_instructions}
                    </div>
                  )}
                </td>
                <td className="text-center p-3">{item.quantity}</td>
                <td className="text-right p-3">₦{item.unit_price.toLocaleString()}</td>
                <td className="text-right p-3 font-medium">₦{item.total_price.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pricing Summary */}
      <div className="flex justify-end mb-8">
        <div className="w-80 space-y-2 text-sm">
          {order.subtotal !== undefined && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">₦{order.subtotal.toLocaleString()}</span>
            </div>
          )}
          {order.tax_amount !== undefined && order.tax_amount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Tax/VAT:</span>
              <span className="font-medium">₦{order.tax_amount.toLocaleString()}</span>
            </div>
          )}
          {order.delivery_fee !== undefined && order.delivery_fee > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Delivery Fee:</span>
              <span className="font-medium">₦{order.delivery_fee.toLocaleString()}</span>
            </div>
          )}
          {order.discount_amount !== undefined && order.discount_amount > 0 && (
            <div className="flex justify-between py-2 text-green-600">
              <span>Discount:</span>
              <span className="font-medium">-₦{order.discount_amount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between py-3 border-t-2 border-gray-300">
            <span className="text-lg font-bold">Total:</span>
            <span className="text-lg font-bold text-primary">₦{order.total_amount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Special Instructions */}
      {order.special_instructions && (
        <div className="mb-8 bg-gray-50 p-4 rounded">
          <h3 className="font-semibold text-sm mb-2">Special Instructions:</h3>
          <p className="text-sm text-gray-700">{order.special_instructions}</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-gray-300 pt-6 mt-8 text-center text-sm text-gray-600">
        <p className="mb-2">Thank you for your order!</p>
        {businessSettings?.whatsapp_support_number && (
          <p className="mb-1">
            Support: {businessSettings.whatsapp_support_number}
          </p>
        )}
        {businessSettings?.website_url && (
          <p>{businessSettings.website_url}</p>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Generated on {format(new Date(), 'MMM dd, yyyy hh:mm a')}
        </p>
      </div>
    </div>
  );
};
