import React from 'react';
import { OrderWithItems } from '@/api/orders';
import { format } from 'date-fns';

interface JobOrderPrintProps {
  order: OrderWithItems;
  items?: any[];
  deliverySchedule?: any;
  pickupPoint?: any;
}

export const JobOrderPrint: React.FC<JobOrderPrintProps> = ({
  order,
  items = [],
  deliverySchedule,
  pickupPoint
}) => {
  const orderItems = items.length > 0 ? items : order.order_items || [];
  
  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  const getDeliveryInfo = () => {
    if (order.order_type === 'pickup' && pickupPoint) {
      return {
        type: 'Pickup',
        address: pickupPoint.address || 'Pickup Point',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled'
      };
    } else if (order.order_type === 'delivery') {
      return {
        type: 'Delivery',
        address: order.delivery_address || 'Not provided',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled'
      };
    }
    return { type: 'Unknown', address: 'Not provided', time: 'Not scheduled' };
  };

  const deliveryInfo = getDeliveryInfo();

  return (
    <div className="job-order-print">
      <style>{`
        .job-order-print {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20mm;
          background: white;
          color: #1a1a1a;
          font-size: 11pt;
          line-height: 1.4;
        }

        .job-order-print h1 {
          font-size: 24pt;
          font-weight: bold;
          text-align: center;
          margin: 0 0 10mm 0;
          color: #2c3e50;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .job-order-print h2 {
          font-size: 14pt;
          font-weight: bold;
          margin: 8mm 0 4mm 0;
          color: #34495e;
          border-bottom: 2px solid #3498db;
          padding-bottom: 2mm;
        }

        .job-order-print .header-info {
          text-align: center;
          margin-bottom: 8mm;
          padding-bottom: 4mm;
          border-bottom: 1px solid #bdc3c7;
        }

        .job-order-print .order-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6mm;
          font-weight: bold;
        }

        .job-order-print .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8mm;
          margin-bottom: 6mm;
        }

        .job-order-print .info-section {
          background: #f8f9fa;
          padding: 4mm;
          border-radius: 2mm;
          border-left: 4px solid #3498db;
        }

        .job-order-print .info-row {
          margin-bottom: 2mm;
        }

        .job-order-print .info-label {
          font-weight: bold;
          color: #2c3e50;
          display: inline-block;
          width: 35%;
          vertical-align: top;
        }

        .job-order-print .info-value {
          color: #34495e;
          display: inline-block;
          width: 65%;
          vertical-align: top;
        }

        .job-order-print .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 4mm 0;
        }

        .job-order-print .items-table th {
          background: #34495e;
          color: white;
          padding: 3mm;
          text-align: left;
          font-weight: bold;
          border-bottom: 2px solid #2c3e50;
        }

        .job-order-print .items-table td {
          padding: 3mm;
          border-bottom: 1px solid #bdc3c7;
          vertical-align: top;
        }

        .job-order-print .items-table tr:nth-child(even) {
          background: #f8f9fa;
        }

        .job-order-print .total-section {
          background: #ecf0f1;
          padding: 4mm;
          border-radius: 2mm;
          margin: 6mm 0;
          border: 2px solid #3498db;
        }

        .job-order-print .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1mm;
        }

        .job-order-print .total-row.grand-total {
          font-weight: bold;
          font-size: 13pt;
          color: #2c3e50;
          padding-top: 2mm;
          border-top: 2px solid #34495e;
          margin-top: 2mm;
        }

        .job-order-print .instructions-section {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 2mm;
          padding: 4mm;
          margin: 4mm 0;
        }

        .job-order-print .status-badge {
          display: inline-block;
          padding: 1mm 3mm;
          border-radius: 2mm;
          font-weight: bold;
          text-transform: uppercase;
          font-size: 9pt;
        }

        .job-order-print .status-paid { background: #d4edda; color: #155724; }
        .job-order-print .status-pending { background: #fff3cd; color: #856404; }
        .job-order-print .status-delivery { background: #cce5ff; color: #004085; }
        .job-order-print .status-pickup { background: #e2e6ea; color: #383d41; }

        @media print {
          .job-order-print {
            padding: 15mm;
            margin: 0;
            box-shadow: none;
            border: none;
            font-size: 10pt;
          }
        }
      `}</style>

      {/* Header */}
      <div className="header-info">
        <h1>Job Order</h1>
        <div className="order-meta">
          <span>Order #{order.order_number}</span>
          <span>Date: {format(new Date(order.order_time), 'PPP')}</span>
        </div>
      </div>

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
              <span className={`status-badge ${order.order_type === 'delivery' ? 'status-delivery' : 'status-pickup'}`}>
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
              <span className={`status-badge ${order.payment_status === 'paid' ? 'status-paid' : 'status-pending'}`}>
                {order.payment_status.toUpperCase()}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Delivery Information */}
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
                <strong>{item.product?.name || item.name || 'Unknown Item'}</strong>
                {item.product?.features && (
                  <div style={{ fontSize: '9pt', color: '#6c757d', marginTop: '1mm' }}>
                    Features: {Array.isArray(item.product.features) 
                      ? item.product.features.join(', ') 
                      : item.product.features}
                  </div>
                )}
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
          <span>{formatCurrency(order.subtotal || 0)}</span>
        </div>
        {order.delivery_fee > 0 && (
          <div className="total-row">
            <span>Delivery Fee:</span>
            <span>{formatCurrency(order.delivery_fee)}</span>
          </div>
        )}
        {order.total_vat > 0 && (
          <div className="total-row">
            <span>VAT:</span>
            <span>{formatCurrency(order.total_vat)}</span>
          </div>
        )}
        {order.discount_amount > 0 && (
          <div className="total-row">
            <span>Discount:</span>
            <span>-{formatCurrency(order.discount_amount)}</span>
          </div>
        )}
        <div className="total-row grand-total">
          <span>TOTAL AMOUNT:</span>
          <span>{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      {/* Special Instructions */}
      {(order.special_instructions || deliverySchedule?.special_instructions) && (
        <div className="instructions-section">
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
        borderTop: '1px solid #bdc3c7',
        textAlign: 'center',
        fontSize: '9pt',
        color: '#6c757d'
      }}>
        <p>Generated on {format(new Date(), 'PPP p')}</p>
      </div>
    </div>
  );
};