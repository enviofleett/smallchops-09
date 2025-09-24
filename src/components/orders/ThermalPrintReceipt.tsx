import React from 'react';
import { OrderWithItems } from '@/api/orders';
import { format } from 'date-fns';

interface ThermalPrintReceiptProps {
  order: OrderWithItems;
  deliverySchedule?: any;
  businessInfo?: {
    name: string;
    admin_notification_email?: string;
    whatsapp_support_number?: string;
    logo_url?: string;
    printed_by?: string;
    printed_on?: string;
  };
}

export const ThermalPrintReceipt: React.FC<ThermalPrintReceiptProps> = ({
  order,
  deliverySchedule,
  businessInfo
}) => {
  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  const getOrderTypeDisplay = () => {
    return order.order_type === 'delivery' ? 'Delivery' : 'Pickup';
  };

  const getDeliveryInfo = () => {
    if (order.order_type === 'delivery' && order.delivery_address) {
      const address = typeof order.delivery_address === 'string' 
        ? order.delivery_address 
        : (order.delivery_address as any)?.formatted_address || 'Address on file';
      
      const instructions = typeof order.delivery_address === 'object'
        ? (order.delivery_address as any)?.instructions
        : null;

      return { address, instructions };
    }
    return null;
  };

  const getItemDetails = (item: any) => {
    const product = item.products || {};
    const details = [];
    
    // Add product description if available
    if (product.description) {
      details.push(`Desc: ${product.description}`);
    }
    
    // Add ingredients if available
    if (product.ingredients && Array.isArray(product.ingredients)) {
      details.push(`Ingredients: ${product.ingredients.join(', ')}`);
    }
    
    // Add features/customizations if available
    if (product.features && Array.isArray(product.features)) {
      details.push(`Features: ${product.features.join(', ')}`);
    }
    
    return details;
  };

  const deliveryInfo = getDeliveryInfo();
  
  return (
    <div className="thermal-receipt" style={{ display: 'none' }}>
      <div className="receipt-content">
        {/* Business Header */}
        <div className="text-center mb-2">
          <div className="business-name">{businessInfo?.name || 'STARTERS SMALL CHOPS'}</div>
          {businessInfo?.whatsapp_support_number && (
            <div className="contact">Contact: {businessInfo.whatsapp_support_number}</div>
          )}
        </div>
        
        <div className="divider">================================</div>
        
        {/* Order Info */}
        <div className="order-info">
          <div>ORDER #: {order.order_number}</div>
          <div>Date: {format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</div>
          <div>Type: {getOrderTypeDisplay()}</div>
          <div>Status: {order.status?.replace('_', ' ').toUpperCase()}</div>
        </div>
        
        <div className="divider">================================</div>
        
        {/* Customer Info */}
        <div className="customer-info">
          <div className="section-header">CUSTOMER INFO:</div>
          <div>Name: {order.customer_name}</div>
          {order.customer_phone && <div>Phone: {order.customer_phone}</div>}
          {order.customer_email && <div>Email: {order.customer_email}</div>}
        </div>
        
        <div className="divider">================================</div>
        
        {/* Delivery/Pickup Schedule */}
        <div className="schedule-info">
          <div className="section-header">{getOrderTypeDisplay().toUpperCase()}/PICKUP SCHEDULE:</div>
          {deliverySchedule && (
            <>
              <div>Date: {format(new Date(deliverySchedule.delivery_date), 'yyyy-MM-dd')}</div>
              <div>Time: {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}</div>
              {deliveryInfo?.address && <div>Address: {deliveryInfo.address}</div>}
              {deliveryInfo?.instructions && <div>Instructions: {deliveryInfo.instructions}</div>}
              {deliverySchedule.special_instructions && (
                <div>Special Notes: {deliverySchedule.special_instructions}</div>
              )}
            </>
          )}
          {!deliverySchedule && order.order_type === 'delivery' && deliveryInfo?.address && (
            <div>Address: {deliveryInfo.address}</div>
          )}
        </div>
        
        <div className="divider">================================</div>
        
        {/* Order Items with Details */}
        <div className="items-section">
          <div className="section-header">ORDER ITEMS & DETAILS:</div>
          <div className="divider">--------------------------------</div>
          
          {order.order_items?.map((item, index) => {
            const itemDetails = getItemDetails(item);
            return (
              <div key={index} className="item-block">
                <div className="item-header">
                  <span>{item.product_name}</span>
                  <span className="item-total">{formatCurrency(item.total_price || 0)}</span>
                </div>
                <div className="item-meta">
                  Qty: {item.quantity}
                  {item.unit_price && (
                    <span> @ {formatCurrency(item.unit_price)}</span>
                  )}
                </div>
                
                {itemDetails.map((detail, detailIndex) => (
                  <div key={detailIndex} className="item-detail">
                    {detail}
                  </div>
                ))}
                
                {index < order.order_items.length - 1 && <div className="item-spacer"></div>}
              </div>
            );
          })}
          
          <div className="divider">--------------------------------</div>
        </div>
        
        {/* Order Summary */}
        <div className="order-summary">
          <div className="summary-line">
            <span>Subtotal:</span>
            <span>{formatCurrency(order.subtotal || 0)}</span>
          </div>
          {order.delivery_fee && order.delivery_fee > 0 && (
            <div className="summary-line">
              <span>Delivery Fee:</span>
              <span>{formatCurrency(order.delivery_fee)}</span>
            </div>
          )}
          {order.total_vat && order.total_vat > 0 && (
            <div className="summary-line">
              <span>VAT ({((order.total_vat / (order.subtotal || 1)) * 100).toFixed(1)}%):</span>
              <span>{formatCurrency(order.total_vat)}</span>
            </div>
          )}
          {/* Discount field not available in current order structure */}
          
          <div className="divider">--------------------------------</div>
          
          <div className="total-line">
            <span>TOTAL:</span>
            <span>{formatCurrency(order.total_amount)}</span>
          </div>
        </div>
        
        <div className="divider">================================</div>
        
        {/* Payment Info */}
        <div className="payment-info">
          <div>Payment: {order.payment_status?.toUpperCase()}</div>
          {order.payment_method && <div>Method: {order.payment_method}</div>}
          {order.payment_reference && <div>Ref: {order.payment_reference}</div>}
        </div>
        
        <div className="divider">================================</div>
        
        {/* Preparation Notes */}
        {(order.admin_notes || deliverySchedule?.special_instructions || deliveryInfo?.instructions) && (
          <>
            <div className="prep-notes">
              <div className="section-header">PREPARATION NOTES:</div>
              {order.admin_notes && <div>- {order.admin_notes}</div>}
              {deliverySchedule?.special_instructions && (
                <div>- {deliverySchedule.special_instructions}</div>
              )}
              {deliveryInfo?.instructions && (
                <div>- Delivery: {deliveryInfo.instructions}</div>
              )}
            </div>
            <div className="divider">================================</div>
          </>
        )}
        
        {/* Footer */}
        <div className="receipt-footer text-center">
          <div>Thank you for your order!</div>
          <div>Estimated prep time: 25-30 mins</div>
          {businessInfo?.whatsapp_support_number && (
            <div>For support: {businessInfo.whatsapp_support_number}</div>
          )}
          {businessInfo?.admin_notification_email && (
            <div>Email: {businessInfo.admin_notification_email}</div>
          )}
          
          <div className="divider">================================</div>
          
          {/* Admin Print Information */}
          {businessInfo?.printed_by && (
            <div className="admin-print-info" style={{ fontSize: '7px', marginTop: '4px' }}>
              <div style={{ fontWeight: 'bold' }}>Printed by: {businessInfo.printed_by}</div>
              {businessInfo.printed_on && (
                <div>On: {businessInfo.printed_on}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThermalPrintReceipt;