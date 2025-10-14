import { OrderStatus } from '@/types/orderDetailsModal';

export interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  status: OrderStatus;
  order_type: 'delivery' | 'pickup';
  created_at: string;
  items?: Array<{
    product_name?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  delivery_address?: any;
  pickup_time?: string;
  special_instructions?: string;
}

export interface EmailTemplateData {
  orderData: OrderData;
  adminEmail: string;
  trackingUrl?: string;
}

/**
 * Generate email subject for order status
 */
export function getOrderStatusSubject(status: OrderStatus, orderNumber: string): string {
  const subjects: Record<OrderStatus, string> = {
    pending: `Order ${orderNumber} - Payment Pending`,
    confirmed: `Order ${orderNumber} - Confirmed and Processing`,
    preparing: `Order ${orderNumber} - Being Prepared`,
    ready: `Order ${orderNumber} - Ready for ${status === 'ready' ? 'Collection' : 'Delivery'}`,
    out_for_delivery: `Order ${orderNumber} - Out for Delivery`,
    delivered: `Order ${orderNumber} - Successfully Delivered`,
    cancelled: `Order ${orderNumber} - Cancelled`,
    refunded: `Order ${orderNumber} - Refunded`,
    completed: `Order ${orderNumber} - Completed`,
    returned: `Order ${orderNumber} - Returned`
  };

  return subjects[status] || `Order ${orderNumber} - Status Update`;
}

/**
 * Generate email template for order status
 */
export function getOrderStatusTemplate(status: OrderStatus, data: EmailTemplateData): string {
  const { orderData, adminEmail, trackingUrl } = data;
  const isDelivery = orderData.order_type === 'delivery';
  
  const baseTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${getOrderStatusSubject(status, orderData.order_number)}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
        .content { background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; text-transform: uppercase; }
        .order-details { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .items-list { margin: 20px 0; }
        .item { border-bottom: 1px solid #e9ecef; padding: 10px 0; }
        .total { font-weight: bold; font-size: 18px; color: #28a745; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; }
        .cta-button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Starters</h1>
        <p>Your order status has been updated</p>
      </div>
      
      <div class="content">
        <h2>Hello ${orderData.customer_name},</h2>
        
        ${getStatusMessage(status, isDelivery)}
        
        <div class="order-details">
          <h3>Order Details</h3>
          <p><strong>Order Number:</strong> ${orderData.order_number}</p>
          <p><strong>Status:</strong> <span class="status-badge" style="background-color: ${getStatusColor(status)}">${status.replace('_', ' ')}</span></p>
          <p><strong>Order Type:</strong> ${isDelivery ? 'Delivery' : 'Pickup'}</p>
          <p><strong>Total Amount:</strong> <span class="total">₦${orderData.total_amount.toLocaleString()}</span></p>
        </div>

        ${orderData.items ? generateItemsList(orderData.items) : ''}
        
        ${getStatusSpecificContent(status, orderData, trackingUrl)}
        
        ${orderData.special_instructions ? `
          <div style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #856404;">Special Instructions:</h4>
            <p style="margin-bottom: 0;">${orderData.special_instructions}</p>
          </div>
        ` : ''}
        
        <p>If you have any questions about your order, please don't hesitate to contact us.</p>
        
        <p>Thank you for choosing Starters!</p>
      </div>
      
      <div class="footer">
        <p>© 2024 Starters. All rights reserved.</p>
        <p>Questions? Contact us at <a href="mailto:${adminEmail}">${adminEmail}</a></p>
      </div>
    </body>
    </html>
  `;

  return baseTemplate;
}

function getStatusMessage(status: OrderStatus, isDelivery: boolean): string {
  const messages: Record<OrderStatus, string> = {
    pending: '<p>We have received your order and are processing your payment. You will receive another notification once payment is confirmed.</p>',
    confirmed: '<p>Great news! Your order has been confirmed and we are preparing your delicious small chops.</p>',
    preparing: '<p>Our kitchen team is now preparing your order with fresh ingredients. It will be ready soon!</p>',
    ready: `<p>Your order is ready for ${isDelivery ? 'delivery! Our delivery team will be with you shortly.' : 'pickup! Please come collect your order at your convenience.'}</p>`,
    out_for_delivery: '<p>Your order is on its way! Our delivery rider is currently en route to your location.</p>',
    delivered: '<p>Your order has been successfully delivered! We hope you enjoy your delicious small chops.</p>',
    cancelled: '<p>We regret to inform you that your order has been cancelled. If you have any questions, please contact our support team.</p>',
    refunded: '<p>Your order has been cancelled and a full refund has been processed. Please allow 3-5 business days for the refund to reflect in your account.</p>',
    completed: '<p>Your order has been completed! Thank you for choosing Starters Small Chops. We hope you enjoyed your meal!</p>',
    returned: '<p>Your order has been returned. Our team will process the return and contact you regarding next steps.</p>'
  };

  return messages[status] || '<p>Your order status has been updated.</p>';
}

function getStatusColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    pending: '#ffc107',
    confirmed: '#007bff',
    preparing: '#fd7e14',
    ready: '#6f42c1',
    out_for_delivery: '#6610f2',
    delivered: '#28a745',
    cancelled: '#dc3545',
    refunded: '#6c757d',
    completed: '#198754',
    returned: '#dc3545'
  };

  return colors[status] || '#6c757d';
}

function generateItemsList(items: OrderData['items']): string {
  if (!items || items.length === 0) return '';

  const itemsHtml = items.map(item => `
    <div class="item">
      <span><strong>${item.product_name || 'Item'}</strong></span>
      <span style="float: right;">
        ${item.quantity} × ₦${item.unit_price.toLocaleString()} = ₦${item.total_price.toLocaleString()}
      </span>
    </div>
  `).join('');

  return `
    <div class="items-list">
      <h4>Order Items:</h4>
      ${itemsHtml}
    </div>
  `;
}

function getStatusSpecificContent(status: OrderStatus, orderData: OrderData, trackingUrl?: string): string {
  switch (status) {
    case 'confirmed':
      return `
        <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #0c5460;">Estimated Preparation Time</h4>
          <p style="margin-bottom: 0;">Your order will be ready in approximately 30-45 minutes.</p>
        </div>
      `;
    
    case 'preparing':
      return `
        <div style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #856404;">Kitchen Update</h4>
          <p style="margin-bottom: 0;">Your small chops are being freshly prepared by our expert chefs. Almost ready!</p>
        </div>
      `;
    
    case 'ready':
      if (orderData.order_type === 'pickup') {
      return `
        <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #155724;">Ready for Pickup</h4>
          <p>Your order is ready! Please come collect it at:</p>
          <p><strong>Starters - Main Location</strong><br>
            Business Hours: 9:00 AM - 9:00 PM</p>
            ${orderData.pickup_time ? `<p><strong>Pickup Time:</strong> ${orderData.pickup_time}</p>` : ''}
          </div>
        `;
      }
      return '';
    
    case 'out_for_delivery':
      return `
        <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #0c5460;">Delivery in Progress</h4>
          <p>Our delivery rider is on the way to your location.</p>
          ${orderData.delivery_address ? `
            <p><strong>Delivery Address:</strong><br>
            ${typeof orderData.delivery_address === 'string' ? orderData.delivery_address : orderData.delivery_address.address_line_1}</p>
          ` : ''}
          ${trackingUrl ? `<a href="${trackingUrl}" class="cta-button">Track Your Order</a>` : ''}
        </div>
      `;
    
    case 'delivered':
      return `
        <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #155724;">Order Delivered Successfully!</h4>
          <p>We hope you enjoy your delicious small chops! Please rate your experience and let us know how we did.</p>
        </div>
      `;
    
    default:
      return '';
  }
}

/**
 * Generate plain text version of the email
 */
export function getOrderStatusPlainText(status: OrderStatus, data: EmailTemplateData): string {
  const { orderData, adminEmail } = data;
  
  return `
STARTERS - ORDER UPDATE

Hello ${orderData.customer_name},

${getStatusMessage(status, orderData.order_type === 'delivery').replace(/<[^>]*>/g, '')}

ORDER DETAILS:
- Order Number: ${orderData.order_number}
- Status: ${status.replace('_', ' ').toUpperCase()}
- Order Type: ${orderData.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
- Total Amount: ₦${orderData.total_amount.toLocaleString()}

${orderData.items ? `
ORDER ITEMS:
${orderData.items.map(item => `- ${item.product_name || 'Item'}: ${item.quantity} × ₦${item.unit_price.toLocaleString()} = ₦${item.total_price.toLocaleString()}`).join('\n')}
` : ''}

${orderData.special_instructions ? `
SPECIAL INSTRUCTIONS:
${orderData.special_instructions}
` : ''}

If you have any questions about your order, please contact us at ${adminEmail}.

Thank you for choosing Starters!

© 2024 Starters. All rights reserved.
  `.trim();
}