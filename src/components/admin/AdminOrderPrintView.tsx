import React from 'react';
import { formatAddress } from '@/utils/formatAddress';
import { getOrderTimeWindow, formatDeliveryDate } from '@/utils/timeWindowUtils';
import { format } from 'date-fns';

interface AdminOrderPrintViewProps {
  order: any;
  businessSettings?: any;
  adminName?: string;
  adminEmail?: string;
}

export const AdminOrderPrintView: React.FC<AdminOrderPrintViewProps> = ({
  order,
  businessSettings,
  adminName,
  adminEmail
}) => {
  if (!order) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  const calculateSubtotal = () => {
    if (!order.items || order.items.length === 0) return 0;
    return order.items.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);
  };

  const timeWindow = getOrderTimeWindow(order);
  const deliveryDate = formatDeliveryDate(order.delivery_date || order.created_at);
  const printedBy = adminName || adminEmail?.split('@')[0] || 'Admin';
  const printedAt = format(new Date(), 'MMM dd, yyyy h:mm a');
  const deliveryZone = order.delivery_schedule?.delivery_zone ||
    order.delivery_address?.zone ||
    order.delivery_address?.city ||
    null;

  const getFormattedAddress = () => {
    if (order.order_type === 'delivery' && order.delivery_address) {
      return formatAddress(order.delivery_address);
    }
    if (order.order_type === 'pickup' && order.pickup_point) {
      return order.pickup_point.address || 'Pickup location available';
    }
    return 'Address not provided';
  };

  const specialInstructions = order.special_instructions ||
    order.delivery_schedule?.special_instructions ||
    order.delivery_instructions ||
    null;

  return (
    <div className="admin-order-80mm-print">
      {/* Header */}
      <div className="print-header-80mm">
        {businessSettings?.logo_url && (
          <img
            src={businessSettings.logo_url}
            alt={businessSettings.name || 'Business Logo'}
            className="print-logo-80mm"
          />
        )}
        <div className="print-business-name-80mm">{businessSettings?.name?.toUpperCase() || 'BUSINESS'}</div>
      </div>
      <div className="print-title-80mm">
        <div className="bold">ORDER SUMMARY</div>
        <div>Order #{order.order_number}</div>
      </div>

      {/* Customer Info */}
      <div className="section-80mm">
        <div className="section-title-80mm">CUSTOMER</div>
        <div><span className="label-80mm">Name:</span> <span className="bold">{order.customer_name || 'N/A'}</span></div>
        <div><span className="label-80mm">Phone:</span> <span className="bold">{order.customer_phone || 'N/A'}</span></div>
        <div><span className="label-80mm">Email:</span> <span className="bold">{order.customer_email || 'N/A'}</span></div>
        <div><span className="label-80mm">Address:</span> <span className="bold">{getFormattedAddress()}</span></div>
      </div>

      {/* Order Info */}
      <div className="section-80mm">
        <div className="section-title-80mm">ORDER DETAILS</div>
        <div><span className="label-80mm">Status:</span> <span className="bold">{order.status?.toUpperCase() || 'PENDING'}</span></div>
        <div><span className="label-80mm">Type:</span> <span className="bold">{order.order_type?.toUpperCase() || 'N/A'}</span></div>
        <div><span className="label-80mm">Order Time:</span> <span className="bold">{formatDateTime(order.created_at || order.order_time)}</span></div>
        {deliveryDate && (
          <div><span className="label-80mm">{order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Date:</span> <span className="bold">{deliveryDate}</span></div>
        )}
        {timeWindow && (
          <div><span className="label-80mm">Time Window:</span> <span className="bold">{timeWindow}</span></div>
        )}
        {deliveryZone && (
          <div><span className="label-80mm">Zone:</span> <span className="bold">{deliveryZone}</span></div>
        )}
      </div>

      {/* Payment Info */}
      <div className="section-80mm">
        <div className="section-title-80mm">PAYMENT</div>
        <div><span className="label-80mm">Status:</span> <span className="bold">{order.payment_status?.toUpperCase() || 'PENDING'}</span></div>
        {order.payment_method && (
          <div><span className="label-80mm">Method:</span> <span className="bold">{order.payment_method}</span></div>
        )}
        {order.payment_reference && (
          <div><span className="label-80mm">Reference:</span> <span className="bold">{order.payment_reference}</span></div>
        )}
        {order.paid_at && (
          <div><span className="label-80mm">Paid At:</span> <span className="bold">{formatDateTime(order.paid_at)}</span></div>
        )}
      </div>

      {/* Fulfillment Info */}
      <div className="section-80mm">
        <div className="section-title-80mm">FULFILLMENT</div>
        {order.assigned_rider_name && (
          <div><span className="label-80mm">Rider:</span> <span className="bold">{order.assigned_rider_name}</span></div>
        )}
        {order.pickup_point?.name && (
          <div><span className="label-80mm">Pickup Point:</span> <span className="bold">{order.pickup_point.name}</span></div>
        )}
        {order.pickup_point?.contact_phone && (
          <div><span className="label-80mm">Pickup Contact:</span> <span className="bold">{order.pickup_point.contact_phone}</span></div>
        )}
        {specialInstructions && (
          <div><span className="label-80mm">Instructions:</span> <span className="bold">{specialInstructions}</span></div>
        )}
      </div>

      {/* Order Items */}
      <div className="section-80mm">
        <div className="section-title-80mm">ITEMS</div>
        <table className="items-table-80mm">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.items && order.items.length > 0) ? (
              order.items.map((item: any, idx: number) => (
                <tr key={item.id || idx}>
                  <td>
                    <div className="bold">{item.product_name || item.name || 'Item'}</div>
                    {(item.special_instructions || (item.customizations && Object.keys(item.customizations).length > 0)) && (
                      <div className="item-note-80mm">
                        {item.special_instructions && `Note: ${item.special_instructions}`}
                        {item.customizations && Object.keys(item.customizations).length > 0 &&
                          ` (${Object.entries(item.customizations).map(([k, v]) => `${k}: ${v}`).join(', ')})`
                        }
                      </div>
                    )}
                  </td>
                  <td className="center-80mm">{item.quantity || 0}</td>
                  <td className="right-80mm">{formatCurrency(item.unit_price || 0)}</td>
                  <td className="right-80mm">{formatCurrency(item.total_price || 0)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="center-80mm">No items</td>
              </tr>
            )}
          </tbody>
        </table>
        {/* Totals */}
        <div className="totals-80mm">
          <div><span>Subtotal:</span><span>{formatCurrency(order.subtotal || calculateSubtotal())}</span></div>
          {order.vat_amount > 0 && (
            <div><span>VAT:</span><span>{formatCurrency(order.vat_amount)}</span></div>
          )}
          {order.tax_amount > 0 && (
            <div><span>Tax:</span><span>{formatCurrency(order.tax_amount)}</span></div>
          )}
          {order.delivery_fee > 0 && (
            <div><span>Delivery:</span><span>{formatCurrency(order.delivery_fee)}</span></div>
          )}
          {order.discount_amount > 0 && (
            <div><span>Discount:</span><span>-{formatCurrency(order.discount_amount)}</span></div>
          )}
          <div className="grand-total-80mm"><span>GRAND TOTAL:</span><span>{formatCurrency(order.total_amount || 0)}</span></div>
        </div>
      </div>
      {/* Footer */}
      <div className="footer-80mm">
        <div>Printed By: <span className="bold">{printedBy}</span></div>
        <div>On: <span className="bold">{printedAt}</span></div>
      </div>
    </div>
  );
};
