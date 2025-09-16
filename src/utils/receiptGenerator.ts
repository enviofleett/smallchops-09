import { OrderWithItems } from '@/api/orders';

interface BusinessInfo {
  name: string;
  admin_notification_email?: string;
  whatsapp_support_number?: string;
  logo_url?: string;
}

interface ReceiptData {
  order: OrderWithItems;
  deliverySchedule?: any;
  businessInfo?: BusinessInfo | null;
  pickupPoint?: any;
}

export const generateReceiptContent = (data: ReceiptData) => {
  const { order, deliverySchedule, businessInfo, pickupPoint } = data;

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
    
    if (product.description) {
      details.push(`Desc: ${product.description}`);
    }
    
    if (product.ingredients && Array.isArray(product.ingredients)) {
      details.push(`Ingredients: ${product.ingredients.join(', ')}`);
    }
    
    if (product.features && Array.isArray(product.features)) {
      details.push(`Features: ${product.features.join(', ')}`);
    }
    
    return details;
  };

  const deliveryInfo = getDeliveryInfo();

  return {
    formatCurrency,
    getOrderTypeDisplay,
    getDeliveryInfo,
    getItemDetails,
    deliveryInfo,
    businessName: businessInfo?.name || 'STARTERS SMALL CHOPS',
    contactNumber: businessInfo?.whatsapp_support_number,
    adminEmail: businessInfo?.admin_notification_email,
    formattedDate: new Date(order.created_at).toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }),
    formattedScheduleDate: deliverySchedule ? new Date(deliverySchedule.delivery_date).toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : null,
    pickupPointHours: pickupPoint?.operating_hours ? 
      JSON.stringify(pickupPoint.operating_hours).replace(/[{}\"]/g, '').replace(/,/g, ', ') : null
  };
};