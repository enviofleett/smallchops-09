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

  const formatDate = (dateValue: any, formatStr: string) => {
    if (!dateValue) return 'Not specified';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return format(date, formatStr);
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
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
    <div className="thermal-receipt">
      <div className="receipt-content">
        {/* Business Header */}
        <div className="text-center">
          <div className="business-name">STARTERS</div>
          {businessInfo?.whatsapp_support_number && (
            <div className="contact">{businessInfo.whatsapp_support_number}</div>
          )}
        </div>
        
        <div className="divider">========================</div>
        
        {/* Order Info */}
        <div className="order-info">
          <div>#{order.order_number}</div>
          <div>{formatDate(order.created_at, 'dd/MM/yy HH:mm')}</div>
          <div>{getOrderTypeDisplay()} | {order.status?.replace('_', ' ').toUpperCase()}</div>
        </div>
        
        <div className="divider">------------------------</div>
        
        {/* Customer Info */}
        <div className="customer-info">
          <div className="section-header">CUSTOMER:</div>
          <div>{order.customer_name || 'Not provided'}</div>
          {order.customer_phone && <div>{order.customer_phone}</div>}
          {order.customer_email && <div>{order.customer_email}</div>}
        </div>
        
        <div className="divider">------------------------</div>
        
        {/* Delivery/Pickup Schedule */}
        {(deliverySchedule || deliveryInfo?.address) && (
          <>
            <div className="schedule-info">
              <div className="section-header">{getOrderTypeDisplay().toUpperCase()}:</div>
              {deliverySchedule && (
                <>
                  <div>{formatDate(deliverySchedule.delivery_date, 'dd/MM/yy')} {deliverySchedule.delivery_time_start || ''} - {deliverySchedule.delivery_time_end || ''}</div>
                  {deliverySchedule.is_flexible && <div>Flexible timing</div>}
                </>
              )}
              {deliveryInfo?.address && <div>{deliveryInfo.address}</div>}
              {deliveryInfo?.instructions && <div>{deliveryInfo.instructions}</div>}
              {deliverySchedule?.special_instructions && (
                <div>{deliverySchedule.special_instructions}</div>
              )}
              {order.order_type === 'pickup' && !deliverySchedule && (
                <div>Call for pickup</div>
              )}
            </div>
            <div className="divider">------------------------</div>
          </>
        )}
        
         {/* Order Items */}
         <div className="items-section">
           <div className="section-header">ITEMS:</div>
           
           {(order.order_items || []).map((item, index) => (
             <div key={index} className="item-block">
               <div className="item-header">
                 <span>{item.product_name || 'Item'}</span>
               </div>
               <div className="item-meta">
                 Qty: {item.quantity || 1}
               </div>
             </div>
           ))}
          
          <div className="divider">------------------------</div>
        </div>
        
        <div className="divider">========================</div>
        
        {/* Payment Info */}
        <div className="payment-info">
          <div>{order.payment_status?.toUpperCase()}</div>
          {order.payment_reference && <div>Ref: {order.payment_reference}</div>}
        </div>
        
        {/* Preparation Notes */}
        {order.admin_notes && (
          <>
            <div className="divider">------------------------</div>
            <div className="prep-notes">
              <div className="section-header">NOTES:</div>
              <div>{order.admin_notes}</div>
            </div>
          </>
        )}
        
        <div className="divider">========================</div>
        
        {/* Footer */}
        <div className="receipt-footer">
          <div>Thank you!</div>
          {businessInfo?.whatsapp_support_number && (
            <div>{businessInfo.whatsapp_support_number}</div>
          )}
          
          {/* Admin Print Information */}
          {businessInfo?.printed_by && (
            <>
              <div className="divider">------------------------</div>
              <div className="admin-print-info">
                <div>Printed: {businessInfo.printed_by}</div>
                {businessInfo.printed_on && <div>{businessInfo.printed_on}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThermalPrintReceipt;