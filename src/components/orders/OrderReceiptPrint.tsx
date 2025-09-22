import React from 'react';
import { OrderWithItems } from '@/api/orders';
import { format } from 'date-fns';

interface OrderReceiptPrintProps {
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
  adminName?: string;
}

export const OrderReceiptPrint: React.FC<OrderReceiptPrintProps> = ({
  order,
  items = [],
  deliverySchedule,
  pickupPoint,
  businessInfo,
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

  return (
    <div className="receipt-print">
      <style>{`
        .receipt-print {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20mm;
          background: white;
          color: #000000;
          font-size: 12pt;
          line-height: 1.5;
          font-weight: 900 !important;
        }

        .receipt-print * {
          font-weight: 900 !important;
          color: #000000 !important;
        }

        .receipt-print h1 {
          font-size: 28pt;
          font-weight: 900 !important;
          text-align: center;
          margin: 0 0 10mm 0;
          color: #000000 !important;
          text-transform: uppercase;
          letter-spacing: 2px;
          text-shadow: 1px 1px 0px rgba(0,0,0,0.3);
        }

        .receipt-print h2 {
          font-size: 16pt;
          font-weight: 900 !important;
          margin: 8mm 0 4mm 0;
          color: #000000 !important;
          border-bottom: 3px solid #000000;
          padding-bottom: 2mm;
          text-transform: uppercase;
        }

        .receipt-print .header-info {
          text-align: center;
          margin-bottom: 8mm;
          padding-bottom: 4mm;
          border-bottom: 2px solid #000000;
        }

        .receipt-print .business-info {
          text-align: center;
          margin-bottom: 6mm;
          padding: 5mm;
          background: #f0f0f0;
          border: 2px solid #000000;
          border-radius: 2mm;
        }

        .receipt-print .order-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6mm;
          font-weight: 900 !important;
          font-size: 14pt;
        }

        .receipt-print .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8mm;
          margin-bottom: 6mm;
        }

        .receipt-print .info-section {
          background: #f0f0f0;
          padding: 5mm;
          border-radius: 2mm;
          border: 2px solid #000000;
        }

        .receipt-print .info-row {
          margin-bottom: 3mm;
          font-size: 11pt;
        }

        .receipt-print .info-label {
          font-weight: 900 !important;
          color: #000000 !important;
          display: inline-block;
          width: 40%;
          vertical-align: top;
        }

        .receipt-print .info-value {
          color: #000000 !important;
          display: inline-block;
          width: 60%;
          vertical-align: top;
          font-weight: 900 !important;
        }

        .receipt-print .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 4mm 0;
          border: 2px solid #000000;
        }

        .receipt-print .items-table th {
          background: #000000 !important;
          color: #ffffff !important;
          padding: 4mm;
          text-align: left;
          font-weight: 900 !important;
          border: 1px solid #000000;
          font-size: 12pt;
        }

        .receipt-print .items-table td {
          padding: 4mm;
          border: 1px solid #000000;
          vertical-align: top;
          font-weight: 900 !important;
          color: #000000 !important;
          font-size: 11pt;
        }

        .receipt-print .items-table tr:nth-child(even) {
          background: #f0f0f0 !important;
        }

        .receipt-print .total-section {
          background: #e0e0e0 !important;
          padding: 5mm;
          border-radius: 2mm;
          margin: 6mm 0;
          border: 3px solid #000000;
        }

        .receipt-print .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2mm;
          font-size: 12pt;
          font-weight: 900 !important;
        }

        .receipt-print .total-row.grand-total {
          font-weight: 900 !important;
          font-size: 16pt;
          color: #000000 !important;
          padding-top: 3mm;
          border-top: 3px solid #000000;
          margin-top: 3mm;
        }

        .receipt-print .payment-section {
          background: #f5f5f5 !important;
          border: 2px solid #000000;
          border-radius: 2mm;
          padding: 5mm;
          margin: 4mm 0;
        }

        .receipt-print .status-badge {
          display: inline-block;
          padding: 2mm 4mm;
          border-radius: 2mm;
          font-weight: 900 !important;
          text-transform: uppercase;
          font-size: 10pt;
          border: 2px solid #000000;
          background: #ffffff !important;
          color: #000000 !important;
        }

        /* Standard Print Media Query */
        @media print {
          .receipt-print {
            padding: 10mm;
            margin: 0;
            box-shadow: none;
            border: none;
            font-size: 11pt;
            font-weight: 900 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .receipt-print * {
            font-weight: 900 !important;
            color: #000000 !important;
          }
        }

        /* 80mm Thermal Printer Support */
        @media print and (max-width: 80mm) {
          .receipt-print {
            width: 72mm !important;
            max-width: 72mm !important;
            padding: 2mm !important;
            margin: 0 !important;
            font-size: 9pt !important;
            font-weight: 900 !important;
          }

          .receipt-print h1 {
            font-size: 14pt !important;
            margin: 0 0 3mm 0 !important;
            letter-spacing: 1px !important;
          }

          .receipt-print h2 {
            font-size: 11pt !important;
            margin: 3mm 0 2mm 0 !important;
          }

          .receipt-print .info-grid {
            grid-template-columns: 1fr !important;
            gap: 2mm !important;
          }

          .receipt-print .info-section {
            padding: 2mm !important;
            margin-bottom: 2mm !important;
          }

          .receipt-print .info-label {
            width: 100% !important;
            display: block !important;
            margin-bottom: 1mm !important;
          }

          .receipt-print .info-value {
            width: 100% !important;
            display: block !important;
            margin-left: 2mm !important;
          }

          .receipt-print .order-meta {
            flex-direction: column !important;
            gap: 1mm !important;
            font-size: 10pt !important;
          }

          .receipt-print .items-table {
            font-size: 8pt !important;
          }

          .receipt-print .items-table th,
          .receipt-print .items-table td {
            padding: 1mm !important;
            font-size: 8pt !important;
          }

          .receipt-print .total-section {
            padding: 2mm !important;
            font-size: 9pt !important;
          }

          .receipt-print .total-row.grand-total {
            font-size: 11pt !important;
          }
        }

        /* Small thermal printer (58mm) */
        @media print and (max-width: 58mm) {
          .receipt-print {
            width: 54mm !important;
            max-width: 54mm !important;
            font-size: 8pt !important;
          }

          .receipt-print h1 {
            font-size: 12pt !important;
          }

          .receipt-print h2 {
            font-size: 10pt !important;
          }

          .receipt-print .items-table th,
          .receipt-print .items-table td {
            font-size: 7pt !important;
          }
        }

        /* Large format (A4) enhancement */
        @media print and (min-width: 200mm) {
          .receipt-print {
            font-size: 12pt !important;
          }

          .receipt-print h1 {
            font-size: 32pt !important;
          }

          .receipt-print h2 {
            font-size: 18pt !important;
          }

          .receipt-print .items-table th,
          .receipt-print .items-table td {
            font-size: 12pt !important;
            padding: 5mm !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="header-info">
        <h1>Official Receipt</h1>
        <div className="order-meta">
          <span>Receipt #{order.order_number}</span>
          <span>Date: {format(new Date(order.order_time), 'PPP')}</span>
        </div>
      </div>

      {/* Business Information */}
      {businessInfo && (
        <div className="business-info">
          <h2 style={{ fontSize: '18pt', marginBottom: '3mm', border: 'none', textAlign: 'center' }}>
            {businessInfo.name}
          </h2>
          <div style={{ fontSize: '11pt', lineHeight: '1.4' }}>
            <div>{businessInfo.address}</div>
            <div>Phone: {businessInfo.phone}</div>
            <div>Email: {businessInfo.email}</div>
          </div>
        </div>
      )}

      {/* Customer & Order Information */}
      <div className="info-grid">
        <div className="info-section">
          <h2>Customer Information</h2>
          <div className="info-row">
            <span className="info-label">Name:</span>
            <span className="info-value">{order.customer_name || 'Not provided'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Phone:</span>
            <span className="info-value">{order.customer_phone || 'Not provided'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Email:</span>
            <span className="info-value">{order.customer_email || 'Not provided'}</span>
          </div>
        </div>

        <div className="info-section">
          <h2>Order Details</h2>
          <div className="info-row">
            <span className="info-label">Type:</span>
            <span className="info-value">
              <span className="status-badge">
                {deliveryInfo.type}
              </span>
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Status:</span>
            <span className="info-value">{order.status.replace(/_/g, ' ').toUpperCase()}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Payment:</span>
            <span className="info-value">
              <span className="status-badge">
                {order.payment_status?.toUpperCase() || 'PENDING'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Delivery/Pickup Information */}
      <div className="info-section" style={{ marginBottom: '6mm' }}>
        <h2>{deliveryInfo.type} Information</h2>
        <div className="info-row">
          <span className="info-label">Address:</span>
          <span className="info-value">{deliveryInfo.address}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Scheduled:</span>
          <span className="info-value">{deliveryInfo.time}</span>
        </div>
      </div>

      {/* Order Items */}
      <h2>Order Items</h2>
      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: '50%' }}>Item</th>
            <th style={{ width: '15%' }}>Qty</th>
            <th style={{ width: '18%' }}>Unit Price</th>
            <th style={{ width: '17%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {orderItems.map((item: any, index: number) => (
            <tr key={index}>
              <td>
                <strong>{item.product?.name || item.product_name || item.name || 'Unknown Item'}</strong>
                {/* Enhanced Product Details */}
                <div style={{ fontSize: '9pt', color: '#333333', marginTop: '1mm', lineHeight: '1.3' }}>
                  {item.product?.description && (
                    <div style={{ marginBottom: '1mm' }}>
                      <strong>Description:</strong> {item.product.description}
                    </div>
                  )}
                  {item.product?.category && (
                    <div style={{ marginBottom: '1mm' }}>
                      <strong>Category:</strong> {item.product.category}
                    </div>
                  )}
                  {item.product?.features && (
                    <div style={{ marginBottom: '1mm' }}>
                      <strong>Features:</strong> {Array.isArray(item.product.features) 
                        ? item.product.features.join(', ') 
                        : item.product.features}
                    </div>
                  )}
                  {item.product?.ingredients && (
                    <div style={{ marginBottom: '1mm' }}>
                      <strong>Ingredients:</strong> {Array.isArray(item.product.ingredients) 
                        ? item.product.ingredients.join(', ') 
                        : item.product.ingredients}
                    </div>
                  )}
                  {item.product?.allergens && (
                    <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                      <strong>Allergens:</strong> {Array.isArray(item.product.allergens) 
                        ? item.product.allergens.join(', ') 
                        : item.product.allergens}
                    </div>
                  )}
                </div>
              </td>
              <td>{item.quantity}</td>
              <td>{formatCurrency(item.unit_price || 0)}</td>
              <td>{formatCurrency((item.unit_price || 0) * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Order Summary */}
      <div className="total-section">
        <div className="total-row">
          <span>Subtotal:</span>
          <span>{formatCurrency(order.subtotal || order.total_amount || 0)}</span>
        </div>
        {(order.delivery_fee && order.delivery_fee > 0) && (
          <div className="total-row">
            <span>Delivery Fee:</span>
            <span>{formatCurrency(order.delivery_fee)}</span>
          </div>
        )}
        {(order.total_vat && order.total_vat > 0) && (
          <div className="total-row">
            <span>VAT (7.5%):</span>
            <span>{formatCurrency(order.total_vat)}</span>
          </div>
        )}
        {(order.discount_amount && order.discount_amount > 0) && (
          <div className="total-row">
            <span>Discount:</span>
            <span>-{formatCurrency(order.discount_amount)}</span>
          </div>
        )}
        <div className="total-row grand-total">
          <span>TOTAL AMOUNT:</span>
          <span>{formatCurrency(order.total_amount || 0)}</span>
        </div>
      </div>

      {/* Payment Information */}
      <div className="payment-section">
        <h2>Payment Details</h2>
        <div className="info-row">
          <span className="info-label">Payment Status:</span>
          <span className="info-value">
            <span className="status-badge">
              {order.payment_status === 'paid' ? 'PAID ✓' : 'PENDING'}
            </span>
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Payment Method:</span>
          <span className="info-value">
            {order.payment_status === 'paid' ? 'Paystack (Online)' : (order.payment_method || 'Online Payment')}
          </span>
        </div>
        {order.payment_status === 'paid' && (
          <div className="info-row">
            <span className="info-label">Transaction:</span>
            <span className="info-value">✓ Completed Successfully</span>
          </div>
        )}
      </div>

      {/* Special Instructions */}
      {(order.special_instructions || deliverySchedule?.special_instructions) && (
        <div className="payment-section">
          <h2>Special Instructions</h2>
          {order.special_instructions && (
            <div style={{ marginBottom: '2mm' }}>
              <strong>Order Instructions:</strong><br />
              {order.special_instructions}
            </div>
          )}
          {deliverySchedule?.special_instructions && (
            <div>
              <strong>Delivery Instructions:</strong><br />
              {deliverySchedule.special_instructions}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        marginTop: '8mm', 
        paddingTop: '4mm', 
        borderTop: '2px solid #000000',
        textAlign: 'center',
        fontSize: '11pt',
        fontWeight: '900',
        background: '#f0f0f0',
        padding: '4mm',
        borderRadius: '2mm'
      }}>
        <p style={{ marginBottom: '2mm' }}>Thank you for your order!</p>
        <p style={{ marginBottom: '2mm' }}>Keep this receipt for your records.</p>
        
        {adminName && (
          <p style={{ fontWeight: 'bold', color: '#2c3e50', marginTop: '3mm', fontSize: '11pt' }}>
            🧾 Receipt printed by: <span style={{ color: '#1976d2' }}>{adminName}</span>
          </p>
        )}
        <p style={{ fontSize: '9pt', marginTop: '2mm' }}>
          Print Date: {format(new Date(), 'PPP')} | Print Time: {format(new Date(), 'p')}
        </p>
      </div>
    </div>
  );
};