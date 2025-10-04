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
    <div className="admin-print-view">
      {/* Business Header */}
      <div className="print-header">
        {businessSettings?.logo_url && (
          <img
            src={businessSettings.logo_url}
            alt={businessSettings.name || 'Business Logo'}
            className="print-logo"
          />
        )}
        <div className="print-business-name">{businessSettings?.name?.toUpperCase() || 'BUSINESS'}</div>
      </div>

      {/* Order Title */}
      <div className="print-title-section">
        <div className="print-order-title">ORDER SUMMARY</div>
        <div className="print-order-number">Order #{order.order_number}</div>
      </div>

      {/* Two Column Grid */}
      <div className="print-content-grid">
        {/* Left Column */}
        <div>
          {/* Customer Info */}
          <div className="print-section">
            <div className="print-section-heading">CUSTOMER INFORMATION</div>
            <div className="print-info-row">
              <span className="print-label">Name:</span>
              <span>{order.customer_name || 'N/A'}</span>
            </div>
            <div className="print-info-row">
              <span className="print-label">Phone:</span>
              <span>{order.customer_phone || 'N/A'}</span>
            </div>
            <div className="print-info-row">
              <span className="print-label">Email:</span>
              <span>{order.customer_email || 'N/A'}</span>
            </div>
            <div className="print-info-row">
              <span className="print-label">Address:</span>
              <span>{getFormattedAddress()}</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="print-section">
            <div className="print-section-heading">PAYMENT</div>
            <div className="print-info-row">
              <span className="print-label">Status:</span>
              <span className="print-payment-status">{order.payment_status?.toUpperCase() || 'PENDING'}</span>
            </div>
            {order.payment_method && (
              <div className="print-info-row">
                <span className="print-label">Method:</span>
                <span>{order.payment_method}</span>
              </div>
            )}
            {order.payment_reference && (
              <div className="print-info-row">
                <span className="print-label">Reference:</span>
                <span className="print-reference">{order.payment_reference}</span>
              </div>
            )}
            {order.paid_at && (
              <div className="print-info-row">
                <span className="print-label">Paid At:</span>
                <span>{formatDateTime(order.paid_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Order Details */}
          <div className="print-section">
            <div className="print-section-heading">ORDER DETAILS</div>
            <div className="print-info-row">
              <span className="print-label">Status:</span>
              <span className="print-status">{order.status?.toUpperCase() || 'PENDING'}</span>
            </div>
            <div className="print-info-row">
              <span className="print-label">Type:</span>
              <span>{order.order_type?.toUpperCase() || 'N/A'}</span>
            </div>
            <div className="print-info-row">
              <span className="print-label">Order Time:</span>
              <span>{formatDateTime(order.created_at || order.order_time)}</span>
            </div>
            {deliveryDate && (
              <div className="print-info-row">
                <span className="print-label">{order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Date:</span>
                <span>{deliveryDate}</span>
              </div>
            )}
            {timeWindow && (
              <div className="print-info-row">
                <span className="print-label">Time Window:</span>
                <span className="print-time-window">{timeWindow}</span>
              </div>
            )}
            {deliveryZone && (
              <div className="print-info-row">
                <span className="print-label">Zone:</span>
                <span>{deliveryZone}</span>
              </div>
            )}
          </div>

          {/* Fulfillment Info */}
          <div className="print-section">
            <div className="print-section-heading">FULFILLMENT</div>
            {order.assigned_rider_name && (
              <div className="print-info-row">
                <span className="print-label">Rider:</span>
                <span>{order.assigned_rider_name}</span>
              </div>
            )}
            {order.pickup_point?.name && (
              <div className="print-info-row">
                <span className="print-label">Pickup Point:</span>
                <span>{order.pickup_point.name}</span>
              </div>
            )}
            {order.pickup_point?.contact_phone && (
              <div className="print-info-row">
                <span className="print-label">Pickup Contact:</span>
                <span>{order.pickup_point.contact_phone}</span>
              </div>
            )}
            {specialInstructions && (
              <div className="print-info-row">
                <span className="print-label">Instructions:</span>
                <span>{specialInstructions}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="print-items-section">
        <div className="print-section-heading">ORDER ITEMS</div>
        <table className="print-items-table">
          <thead>
            <tr>
              <th className="print-th-left">Item</th>
              <th className="print-th-center">Qty</th>
              <th className="print-th-right">Unit Price</th>
              <th className="print-th-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.items && order.items.length > 0) ? (
              order.items.map((item: any, idx: number) => (
                <tr key={item.id || idx}>
                  <td className="print-td-item">
                    <div className="print-item-name">
                      {item.product_name || item.name || item.product?.name || 'Unknown Item'}
                    </div>
                    {(item.special_instructions || (item.customizations && Object.keys(item.customizations).length > 0)) && (
                      <div className="print-item-note">
                        {item.special_instructions && `Note: ${item.special_instructions}`}
                        {item.customizations && Object.keys(item.customizations).length > 0 &&
                          ` • ${Object.entries(item.customizations).map(([k, v]) => `${k}: ${v}`).join(', ')}`
                        }
                      </div>
                    )}
                  </td>
                  <td className="print-td-center">{item.quantity || 0}</td>
                  <td className="print-td-right">{formatCurrency(item.unit_price || 0)}</td>
                  <td className="print-td-right">{formatCurrency(item.total_price || 0)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="print-td-center">No items</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="print-totals">
          <div className="print-totals-row">
            <span>Subtotal:</span>
            <span>{formatCurrency(order.subtotal || calculateSubtotal())}</span>
          </div>
          {order.vat_amount > 0 && (
            <div className="print-totals-row">
              <span>VAT:</span>
              <span>{formatCurrency(order.vat_amount)}</span>
            </div>
          )}
          {order.tax_amount > 0 && (
            <div className="print-totals-row">
              <span>Tax:</span>
              <span>{formatCurrency(order.tax_amount)}</span>
            </div>
          )}
          {order.delivery_fee > 0 && (
            <div className="print-totals-row">
              <span>Delivery Fee:</span>
              <span>{formatCurrency(order.delivery_fee)}</span>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="print-totals-row">
              <span>Discount:</span>
              <span>-{formatCurrency(order.discount_amount)}</span>
            </div>
          )}
          <div className="print-totals-row print-grand-total">
            <span>GRAND TOTAL:</span>
            <span>{formatCurrency(order.total_amount || 0)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="print-footer">
        <div className="print-footer-row">
          <span className="print-label">Printed By:</span>
          <span>{printedBy}</span>
        </div>
        <div className="print-footer-row">
          <span className="print-label">Printed On:</span>
          <span>{printedAt}</span>
        </div>
      </div>
    </div>
  );
};
