import React from 'react';
import { OrderWithItems } from '@/api/orders';
import { format } from 'date-fns';

interface ThermalOrderPrintProps {
  order: OrderWithItems;
  items?: any[];
  deliverySchedule?: any;
  pickupPoint?: any;
  businessInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  printType: 'job-order' | 'receipt';
  adminName?: string;
}

export const ThermalOrderPrint: React.FC<ThermalOrderPrintProps> = ({
  order,
  items = [],
  deliverySchedule,
  pickupPoint,
  businessInfo,
  printType,
  adminName
}) => {
  const orderItems = items.length > 0 ? items : order.order_items || [];
  
  const formatCurrency = (amount: number | null | undefined) => {
    const validAmount = amount || 0;
    return `₦${validAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  const getDeliveryInfo = () => {
    if (order.order_type === 'pickup' && pickupPoint) {
      return {
        type: 'Pickup',
        address: pickupPoint.address || pickupPoint.name || businessInfo?.address || 'Main Store',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Today (Business Hours)'
      };
    } else if (order.order_type === 'delivery') {
      return {
        type: 'Delivery',
        address: order.delivery_address || 'Address not provided',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'To be scheduled'
      };
    }
    return { 
      type: order.order_type ? order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1) : 'Unknown', 
      address: 'Not provided', 
      time: 'Not scheduled' 
    };
  };

  const deliveryInfo = getDeliveryInfo();

  // Calculate if we need to limit content for 2-page thermal printing
  const itemCount = orderItems.length;
  const hasLongAddress = deliveryInfo.address.length > 50;
  const hasInstructions = order.special_instructions || deliverySchedule?.special_instructions;
  const contentScore = itemCount + (hasLongAddress ? 2 : 0) + (hasInstructions ? 1 : 0);
  const isCondensedMode = contentScore > 8; // Trigger condensed mode for complex orders

  return (
    <div className="thermal-print-container">
      <style>{`
        .thermal-print-container {
          width: 80mm;
          max-width: 80mm;
          margin: 0;
          padding: 2mm;
          background: white;
          color: black;
          font-family: 'Courier New', monospace;
          font-size: 9px;
          line-height: 1.1;
        }

        .thermal-header {
          text-align: center;
          border-bottom: 1px dashed black;
          padding-bottom: 2mm;
          margin-bottom: 2mm;
        }

        .thermal-title {
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 1mm;
        }

        .thermal-business {
          font-size: 8px;
          margin-bottom: 1mm;
        }

        .thermal-order-meta {
          font-size: 8px;
          margin-bottom: 2mm;
        }

        .thermal-section {
          margin-bottom: 2mm;
          border-bottom: 1px dashed #ccc;
          padding-bottom: 1mm;
        }

        .thermal-section-title {
          font-weight: bold;
          font-size: 8px;
          margin-bottom: 1mm;
          text-transform: uppercase;
        }

        .thermal-info-line {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5mm;
          font-size: 8px;
        }

        .thermal-item {
          margin-bottom: 1mm;
          font-size: 8px;
        }

        .thermal-item-name {
          font-weight: bold;
          margin-bottom: 0.5mm;
        }

        .thermal-item-details {
          display: flex;
          justify-content: space-between;
        }

        .thermal-totals {
          border-top: 1px solid black;
          padding-top: 1mm;
          margin-top: 2mm;
        }

        .thermal-total-line {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5mm;
          font-size: 8px;
        }

        .thermal-grand-total {
          font-weight: bold;
          font-size: 10px;
          border-top: 1px solid black;
          padding-top: 1mm;
          margin-top: 1mm;
        }

        .thermal-footer {
          text-align: center;
          font-size: 7px;
          margin-top: 3mm;
          border-top: 1px dashed black;
          padding-top: 2mm;
        }

        .page-break {
          page-break-before: always;
          border-top: 2px dashed #999;
          margin: 3mm 0;
          padding-top: 2mm;
        }

        /* Critical: 80mm thermal print media query */
        @media print {
          .thermal-print-container {
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            font-size: 9px !important;
          }
          
          .page-break {
            page-break-before: always !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* PAGE 1 - Essential Information */}
      <div className="thermal-header">
        <div className="thermal-title">
          {printType === 'job-order' ? 'Job Order' : 'Receipt'}
        </div>
        {businessInfo && (
          <div className="thermal-business">
            <div>{businessInfo.name}</div>
            <div>{businessInfo.phone}</div>
          </div>
        )}
        <div className="thermal-order-meta">
          <div>Order #{order.order_number}</div>
          <div>{format(new Date(order.order_time), 'dd/MM/yyyy HH:mm')}</div>
        </div>
      </div>

      {/* Customer & Order Info */}
      <div className="thermal-section">
        <div className="thermal-section-title">Customer</div>
        <div className="thermal-info-line">
          <span>Name:</span>
          <span>{order.customer_name || 'N/A'}</span>
        </div>
        <div className="thermal-info-line">
          <span>Phone:</span>
          <span>{order.customer_phone || 'N/A'}</span>
        </div>
        <div className="thermal-info-line">
          <span>Type:</span>
          <span>{deliveryInfo.type.toUpperCase()}</span>
        </div>
        <div className="thermal-info-line">
          <span>Status:</span>
          <span>{order.status.replace(/_/g, ' ').toUpperCase()}</span>
        </div>
      </div>

      {/* Delivery/Pickup Info - Condensed */}
      <div className="thermal-section">
        <div className="thermal-section-title">{deliveryInfo.type}</div>
        <div style={{ fontSize: '7px', wordBreak: 'break-word' }}>
          {isCondensedMode ? 
            deliveryInfo.address.substring(0, 60) + (deliveryInfo.address.length > 60 ? '...' : '') :
            deliveryInfo.address
          }
        </div>
        <div style={{ fontSize: '7px', marginTop: '0.5mm' }}>
          {deliverySchedule?.scheduled_date ? 
            format(new Date(deliverySchedule.scheduled_date), 'dd/MM/yyyy HH:mm') : 
            'ASAP'
          }
        </div>
      </div>

      {/* Order Items - Page 1 */}
      <div className="thermal-section">
        <div className="thermal-section-title">Items</div>
        {orderItems.slice(0, isCondensedMode ? 6 : 8).map((item: any, index: number) => (
          <div key={index} className="thermal-item">
            <div className="thermal-item-name">
              {(item.product?.name || item.product_name || item.name || 'Unknown Item').substring(0, 25)}
            </div>
            <div className="thermal-item-details">
              <span>{item.quantity}x {formatCurrency(item.unit_price || 0)}</span>
              <span>{formatCurrency((item.unit_price || 0) * item.quantity)}</span>
            </div>
          </div>
        ))}

        {/* If more items, show continuation indicator */}
        {orderItems.length > (isCondensedMode ? 6 : 8) && (
          <div style={{ textAlign: 'center', fontSize: '7px', fontStyle: 'italic' }}>
            ... +{orderItems.length - (isCondensedMode ? 6 : 8)} more items (see page 2)
          </div>
        )}
      </div>

      {/* ORDER TOTALS - Always on page 1 */}
      <div className="thermal-totals">
        <div className="thermal-total-line">
          <span>Subtotal:</span>
          <span>{formatCurrency(order.subtotal || order.total_amount || 0)}</span>
        </div>
        {(order.delivery_fee && order.delivery_fee > 0) && (
          <div className="thermal-total-line">
            <span>Delivery:</span>
            <span>{formatCurrency(order.delivery_fee)}</span>
          </div>
        )}
        {(order.total_vat && order.total_vat > 0) && (
          <div className="thermal-total-line">
            <span>VAT:</span>
            <span>{formatCurrency(order.total_vat)}</span>
          </div>
        )}
        {(order.discount_amount && order.discount_amount > 0) && (
          <div className="thermal-total-line">
            <span>Discount:</span>
            <span>-{formatCurrency(order.discount_amount)}</span>
          </div>
        )}
        <div className="thermal-total-line thermal-grand-total">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total_amount || 0)}</span>
        </div>
      </div>

      {/* PAGE 2 - Additional items and details (if needed) */}
      {(orderItems.length > (isCondensedMode ? 6 : 8) || hasInstructions) && (
        <div className="page-break">
          {/* Remaining Items */}
          {orderItems.length > (isCondensedMode ? 6 : 8) && (
            <div className="thermal-section">
              <div className="thermal-section-title">Remaining Items</div>
              {orderItems.slice(isCondensedMode ? 6 : 8).map((item: any, index: number) => (
                <div key={index + (isCondensedMode ? 6 : 8)} className="thermal-item">
                  <div className="thermal-item-name">
                    {(item.product?.name || item.product_name || item.name || 'Unknown Item').substring(0, 25)}
                  </div>
                  <div className="thermal-item-details">
                    <span>{item.quantity}x {formatCurrency(item.unit_price || 0)}</span>
                    <span>{formatCurrency((item.unit_price || 0) * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Special Instructions - Only if space permits */}
          {hasInstructions && (
            <div className="thermal-section">
              <div className="thermal-section-title">Instructions</div>
              {order.special_instructions && (
                <div style={{ fontSize: '7px', marginBottom: '1mm' }}>
                  <strong>Order:</strong> {order.special_instructions.substring(0, 100)}
                </div>
              )}
              {deliverySchedule?.special_instructions && (
                <div style={{ fontSize: '7px' }}>
                  <strong>Delivery:</strong> {deliverySchedule.special_instructions.substring(0, 100)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="thermal-footer">
        <div>Payment: {order.payment_status?.toUpperCase() || 'PENDING'}</div>
        {printType === 'receipt' && <div>Thank you for your order!</div>}
        {printType === 'job-order' && adminName && (
          <div>Prepared by: {adminName}</div>
        )}
        <div>{format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
      </div>
    </div>
  );
};