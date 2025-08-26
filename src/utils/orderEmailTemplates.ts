import { Driver } from '@/api/drivers';

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface DeliverySchedule {
  delivery_date: string;
  delivery_time_start: string;
  delivery_time_end: string;
  special_instructions?: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  order_items: OrderItem[];
  delivery_schedule?: DeliverySchedule;
  delivery_address?: any;
}

export function buildOutForDeliveryEmailContent(order: Order, driver?: Driver): {
  subject: string;
  html: string;
} {
  const subject = `Your order #${order.order_number} is out for delivery!`;
  
  const deliveryWindow = order.delivery_schedule 
    ? `${order.delivery_schedule.delivery_time_start} - ${order.delivery_schedule.delivery_time_end}`
    : 'As scheduled';

  const driverInfo = driver ? {
    name: driver.name,
    phone: driver.phone,
    vehicle: driver.vehicle_type
  } : {
    name: 'Will be assigned soon',
    phone: 'N/A',
    vehicle: 'N/A'
  };

  const orderItemsHtml = order.order_items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.product_name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₦${item.total_price.toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #059669; margin: 0; font-size: 28px;">🚚 Your order is on the way!</h1>
        </div>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #059669;">
          <h2 style="color: #065f46; margin: 0 0 10px 0; font-size: 18px;">Order #${order.order_number}</h2>
          <p style="color: #047857; margin: 0; font-size: 16px;">Expected delivery: ${deliveryWindow}</p>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">🚗 Driver Information</h3>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px;">
            <p style="margin: 5px 0; color: #4b5563;"><strong>Name:</strong> ${driverInfo.name}</p>
            <p style="margin: 5px 0; color: #4b5563;"><strong>Phone:</strong> ${driverInfo.phone}</p>
            <p style="margin: 5px 0; color: #4b5563;"><strong>Vehicle:</strong> ${driverInfo.vehicle}</p>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📦 Order Summary</h3>
          <table style="width: 100%; border-collapse: collapse; background-color: white; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Item</th>
                <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Qty</th>
                <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHtml}
              <tr style="background-color: #f9fafb; font-weight: 600;">
                <td style="padding: 12px 8px; border-top: 2px solid #e5e7eb;">Total</td>
                <td style="padding: 12px 8px; border-top: 2px solid #e5e7eb;"></td>
                <td style="padding: 12px 8px; text-align: right; border-top: 2px solid #e5e7eb; color: #059669;">₦${order.total_amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${order.delivery_address ? `
          <div style="margin-bottom: 25px;">
            <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📍 Delivery Address</h3>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px;">
              <p style="margin: 0; color: #4b5563;">${order.delivery_address.address_line_1}</p>
              ${order.delivery_address.address_line_2 ? `<p style="margin: 0; color: #4b5563;">${order.delivery_address.address_line_2}</p>` : ''}
              <p style="margin: 0; color: #4b5563;">${order.delivery_address.city}, ${order.delivery_address.state}</p>
            </div>
          </div>
        ` : ''}

        ${order.delivery_schedule?.special_instructions ? `
          <div style="margin-bottom: 25px;">
            <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📝 Special Instructions</h3>
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e;">${order.delivery_schedule.special_instructions}</p>
            </div>
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
          <p style="color: #6b7280; margin: 0; font-size: 14px;">Thank you for choosing SmallChops-09!</p>
          <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">We appreciate your business.</p>
        </div>
      </div>
    </div>
  `;

  return { subject, html };
}