/**
 * Order Confirmation Email Example
 * 
 * This example demonstrates how to use the send-email function
 * to send order confirmation emails to customers.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface OrderData {
  id: string;
  customerEmail: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  orderDate: string;
  deliveryDate?: string;
}

/**
 * Sends an order confirmation email
 */
export async function sendOrderConfirmationEmail(
  orderData: OrderData,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate email content
    const emailSubject = `Order Confirmation #${orderData.id}`;
    
    const emailText = generatePlainTextEmail(orderData);
    const emailHtml = generateHtmlEmail(orderData);

    // Call the send-email function
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: orderData.customerEmail,
        subject: emailSubject,
        text: emailText,
        html: emailHtml
      }
    });

    if (error) {
      console.error('Failed to send order confirmation email:', error);
      return { success: false, error: error.message };
    }

    console.log('Order confirmation email sent successfully:', data);
    return { success: true };

  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generates plain text email content
 */
function generatePlainTextEmail(orderData: OrderData): string {
  const itemsList = orderData.items
    .map(item => `- ${item.name} (Qty: ${item.quantity}) - ₦${item.price.toLocaleString()}`)
    .join('\n');

  return `
Dear ${orderData.customerName},

Thank you for your order! We've received your order and are preparing it for delivery.

Order Details:
- Order ID: #${orderData.id}
- Order Date: ${new Date(orderData.orderDate).toLocaleDateString()}
${orderData.deliveryDate ? `- Delivery Date: ${new Date(orderData.deliveryDate).toLocaleDateString()}` : ''}

Items Ordered:
${itemsList}

Total: ₦${orderData.total.toLocaleString()}

We'll send you another email with tracking information once your order ships.

If you have any questions about your order, please contact our customer service team.

Best regards,
The Starter Small Chops Team
`.trim();
}

/**
 * Generates HTML email content
 */
function generateHtmlEmail(orderData: OrderData): string {
  const itemsHtml = orderData.items
    .map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₦${item.price.toLocaleString()}</td>
      </tr>
    `)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #2c5aa0; margin: 0; font-size: 24px;">Order Confirmation</h1>
    <p style="margin: 10px 0 0 0; color: #666;">Thank you for your order!</p>
  </div>

  <div style="margin-bottom: 20px;">
    <h2 style="color: #333; font-size: 18px; margin-bottom: 10px;">Hello ${orderData.customerName},</h2>
    <p>We've received your order and are preparing it for delivery.</p>
  </div>

  <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="margin-top: 0; color: #2c5aa0;">Order Details</h3>
    <table style="width: 100%; margin-bottom: 15px;">
      <tr>
        <td style="padding: 5px 0;"><strong>Order ID:</strong></td>
        <td style="padding: 5px 0;">#${orderData.id}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0;"><strong>Order Date:</strong></td>
        <td style="padding: 5px 0;">${new Date(orderData.orderDate).toLocaleDateString()}</td>
      </tr>
      ${orderData.deliveryDate ? `
      <tr>
        <td style="padding: 5px 0;"><strong>Delivery Date:</strong></td>
        <td style="padding: 5px 0;">${new Date(orderData.deliveryDate).toLocaleDateString()}</td>
      </tr>
      ` : ''}
    </table>

    <h4 style="margin: 20px 0 10px 0; color: #333;">Items Ordered:</h4>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Item</th>
          <th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Qty</th>
          <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr style="font-weight: bold; background-color: #f8f9fa;">
          <td style="padding: 10px; border-top: 2px solid #ddd;" colspan="2">Total:</td>
          <td style="padding: 10px; text-align: right; border-top: 2px solid #ddd;">₦${orderData.total.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 14px;">
      <strong>What's next?</strong><br>
      We'll send you another email with tracking information once your order ships.
      If you have any questions, please contact our customer service team.
    </p>
  </div>

  <div style="text-align: center; color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 20px;">
    <p>Best regards,<br><strong>The Starter Small Chops Team</strong></p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Example usage:
 * 
 * ```typescript
 * const orderData: OrderData = {
 *   id: "ORD-2024-001",
 *   customerEmail: "customer@example.com",
 *   customerName: "John Doe",
 *   items: [
 *     { name: "Samosa (10 pieces)", quantity: 2, price: 3000 },
 *     { name: "Spring Rolls (8 pieces)", quantity: 1, price: 2500 }
 *   ],
 *   total: 8500,
 *   orderDate: "2024-01-15T10:30:00Z",
 *   deliveryDate: "2024-01-16T14:00:00Z"
 * };
 * 
 * const result = await sendOrderConfirmationEmail(
 *   orderData,
 *   "your-supabase-url",
 *   "your-service-role-key"
 * );
 * 
 * if (result.success) {
 *   console.log("Order confirmation email sent successfully!");
 * } else {
 *   console.error("Failed to send email:", result.error);
 * }
 * ```
 */