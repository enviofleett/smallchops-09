import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductionTemplate {
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template: string;
  variables: string[];
  template_type: 'transactional' | 'marketing';
  category: string;
  style: string;
  is_active: boolean;
  full_html: boolean;
}

const PRODUCTION_TEMPLATES: ProductionTemplate[] = [
  {
    template_key: 'customer_welcome',
    template_name: 'Customer Welcome Email',
    subject_template: 'Welcome to {{business_name}}!',
    html_template: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 300;">Welcome to {{business_name}}</h1>
        </div>
        <div style="padding: 40px; background: #ffffff;">
          <h2 style="color: #333; font-size: 22px; margin-top: 0;">Hi {{customer_name}},</h2>
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Thank you for joining us! We're excited to have you as part of our community.
          </p>
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Your account is now active and ready to use. Start exploring our products and services.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{website_url}}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 500;">
              Start Shopping
            </a>
          </div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>© {{current_year}} {{business_name}}. All rights reserved.</p>
        </div>
      </div>
    `,
    text_template: `Welcome to {{business_name}}!\n\nHi {{customer_name}},\n\nThank you for joining us! We're excited to have you as part of our community.\n\nYour account is now active and ready to use. Start exploring our products and services.\n\nVisit us at: {{website_url}}\n\n© {{current_year}} {{business_name}}. All rights reserved.`,
    variables: ['business_name', 'customer_name', 'website_url', 'current_year'],
    template_type: 'transactional',
    category: 'customer',
    style: 'modern',
    is_active: true,
    full_html: true
  },
  {
    template_key: 'order_confirmation',
    template_name: 'Order Confirmation',
    subject_template: 'Order Confirmation - {{order_number}}',
    html_template: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="background: #28a745; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Order Confirmed!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Order #{{order_number}}</p>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #333; font-size: 20px; margin-top: 0;">Hi {{customer_name}},</h2>
          <p style="color: #666; line-height: 1.6;">
            Thank you for your order! We've received your order and are preparing it for delivery.
          </p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333;">Order Details</h3>
            <p style="margin: 5px 0; color: #666;"><strong>Order Number:</strong> {{order_number}}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Order Date:</strong> {{order_date}}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Total Amount:</strong> {{total_amount}}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Delivery Address:</strong> {{delivery_address}}</p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            We'll send you another email when your order is out for delivery.
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>Need help? Contact us at {{support_email}}</p>
          <p>© {{current_year}} {{business_name}}. All rights reserved.</p>
        </div>
      </div>
    `,
    text_template: `Order Confirmed!\nOrder #{{order_number}}\n\nHi {{customer_name}},\n\nThank you for your order! We've received your order and are preparing it for delivery.\n\nOrder Details:\nOrder Number: {{order_number}}\nOrder Date: {{order_date}}\nTotal Amount: {{total_amount}}\nDelivery Address: {{delivery_address}}\n\nWe'll send you another email when your order is out for delivery.\n\nNeed help? Contact us at {{support_email}}\n© {{current_year}} {{business_name}}. All rights reserved.`,
    variables: ['business_name', 'customer_name', 'order_number', 'order_date', 'total_amount', 'delivery_address', 'support_email', 'current_year'],
    template_type: 'transactional',
    category: 'orders',
    style: 'modern',
    is_active: true,
    full_html: true
  },
  {
    template_key: 'out_for_delivery',
    template_name: 'Order Out for Delivery',
    subject_template: 'Your order {{order_number}} is on the way!',
    html_template: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="background: #ffc107; padding: 30px; text-align: center; color: #333;">
          <h1 style="margin: 0; font-size: 24px;">📦 Out for Delivery</h1>
          <p style="margin: 10px 0 0 0;">Order #{{order_number}}</p>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #333; font-size: 20px; margin-top: 0;">Hi {{customer_name}},</h2>
          <p style="color: #666; line-height: 1.6;">
            Great news! Your order is now out for delivery and should arrive soon.
          </p>
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #856404;">🚚 Delivery Information</h3>
            <p style="margin: 5px 0; color: #856404;"><strong>Expected Delivery:</strong> {{estimated_delivery_time}}</p>
            <p style="margin: 5px 0; color: #856404;"><strong>Delivery Address:</strong> {{delivery_address}}</p>
            {{#driver_name}}<p style="margin: 5px 0; color: #856404;"><strong>Driver:</strong> {{driver_name}}</p>{{/driver_name}}
            {{#driver_phone}}<p style="margin: 5px 0; color: #856404;"><strong>Driver Phone:</strong> {{driver_phone}}</p>{{/driver_phone}}
          </div>
          <p style="color: #666; line-height: 1.6;">
            Please ensure someone is available to receive the delivery.
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>Questions? Contact us at {{support_email}}</p>
          <p>© {{current_year}} {{business_name}}. All rights reserved.</p>
        </div>
      </div>
    `,
    text_template: `📦 Out for Delivery\nOrder #{{order_number}}\n\nHi {{customer_name}},\n\nGreat news! Your order is now out for delivery and should arrive soon.\n\n🚚 Delivery Information:\nExpected Delivery: {{estimated_delivery_time}}\nDelivery Address: {{delivery_address}}\nDriver: {{driver_name}}\nDriver Phone: {{driver_phone}}\n\nPlease ensure someone is available to receive the delivery.\n\nQuestions? Contact us at {{support_email}}\n© {{current_year}} {{business_name}}. All rights reserved.`,
    variables: ['business_name', 'customer_name', 'order_number', 'estimated_delivery_time', 'delivery_address', 'driver_name', 'driver_phone', 'support_email', 'current_year'],
    template_type: 'transactional',
    category: 'orders', 
    style: 'modern',
    is_active: true,
    full_html: true
  },
  {
    template_key: 'delivery_completed',
    template_name: 'Delivery Completed',
    subject_template: 'Order {{order_number}} has been delivered!',
    html_template: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="background: #28a745; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">✅ Delivered Successfully!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Order #{{order_number}}</p>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #333; font-size: 20px; margin-top: 0;">Hi {{customer_name}},</h2>
          <p style="color: #666; line-height: 1.6;">
            Your order has been successfully delivered! We hope you enjoy your purchase.
          </p>
          <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #155724;">📋 Delivery Summary</h3>
            <p style="margin: 5px 0; color: #155724;"><strong>Delivered At:</strong> {{delivery_time}}</p>
            <p style="margin: 5px 0; color: #155724;"><strong>Delivery Address:</strong> {{delivery_address}}</p>
            <p style="margin: 5px 0; color: #155724;"><strong>Received By:</strong> {{received_by}}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{review_url}}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 500;">
              Leave a Review
            </a>
          </div>
          <p style="color: #666; line-height: 1.6;">
            Thank you for choosing {{business_name}}. We appreciate your business!
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>Questions? Contact us at {{support_email}}</p>
          <p>© {{current_year}} {{business_name}}. All rights reserved.</p>
        </div>
      </div>
    `,
    text_template: `✅ Delivered Successfully!\nOrder #{{order_number}}\n\nHi {{customer_name}},\n\nYour order has been successfully delivered! We hope you enjoy your purchase.\n\n📋 Delivery Summary:\nDelivered At: {{delivery_time}}\nDelivery Address: {{delivery_address}}\nReceived By: {{received_by}}\n\nLeave a review: {{review_url}}\n\nThank you for choosing {{business_name}}. We appreciate your business!\n\nQuestions? Contact us at {{support_email}}\n© {{current_year}} {{business_name}}. All rights reserved.`,
    variables: ['business_name', 'customer_name', 'order_number', 'delivery_time', 'delivery_address', 'received_by', 'review_url', 'support_email', 'current_year'],
    template_type: 'transactional',
    category: 'orders',
    style: 'modern',
    is_active: true,
    full_html: true
  },
  {
    template_key: 'pickup_ready',
    template_name: 'Order Ready for Pickup',
    subject_template: 'Your order {{order_number}} is ready for pickup!',
    html_template: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="background: #17a2b8; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">🎉 Ready for Pickup!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Order #{{order_number}}</p>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #333; font-size: 20px; margin-top: 0;">Hi {{customer_name}},</h2>
          <p style="color: #666; line-height: 1.6;">
            Great news! Your order is ready for pickup. Please visit our store at your convenience.
          </p>
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #0c5460;">📍 Pickup Information</h3>
            <p style="margin: 5px 0; color: #0c5460;"><strong>Pickup Location:</strong> {{pickup_address}}</p>
            <p style="margin: 5px 0; color: #0c5460;"><strong>Store Hours:</strong> {{store_hours}}</p>
            <p style="margin: 5px 0; color: #0c5460;"><strong>Pickup Code:</strong> {{pickup_code}}</p>
            <p style="margin: 5px 0; color: #0c5460;"><strong>Valid Until:</strong> {{pickup_deadline}}</p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            Please bring a valid ID and mention your pickup code when collecting your order.
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>Questions? Contact us at {{support_email}}</p>
          <p>© {{current_year}} {{business_name}}. All rights reserved.</p>
        </div>
      </div>
    `,
    text_template: `🎉 Ready for Pickup!\nOrder #{{order_number}}\n\nHi {{customer_name}},\n\nGreat news! Your order is ready for pickup. Please visit our store at your convenience.\n\n📍 Pickup Information:\nPickup Location: {{pickup_address}}\nStore Hours: {{store_hours}}\nPickup Code: {{pickup_code}}\nValid Until: {{pickup_deadline}}\n\nPlease bring a valid ID and mention your pickup code when collecting your order.\n\nQuestions? Contact us at {{support_email}}\n© {{current_year}} {{business_name}}. All rights reserved.`,
    variables: ['business_name', 'customer_name', 'order_number', 'pickup_address', 'store_hours', 'pickup_code', 'pickup_deadline', 'support_email', 'current_year'],
    template_type: 'transactional',
    category: 'orders',
    style: 'modern',
    is_active: true,
    full_html: true
  },
  {
    template_key: 'payment_receipt',
    template_name: 'Payment Receipt',
    subject_template: 'Payment Receipt - {{transaction_id}}',
    html_template: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="background: #6f42c1; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">💳 Payment Receipt</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Transaction #{{transaction_id}}</p>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #333; font-size: 20px; margin-top: 0;">Hi {{customer_name}},</h2>
          <p style="color: #666; line-height: 1.6;">
            Your payment has been successfully processed. Here's your receipt for your records.
          </p>
          <div style="background: #f8f9fa; border: 2px solid #6f42c1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #6f42c1;">💰 Payment Details</h3>
            <p style="margin: 5px 0; color: #333;"><strong>Amount Paid:</strong> {{amount}}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Payment Method:</strong> {{payment_method}}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Transaction Date:</strong> {{payment_date}}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Order Number:</strong> {{order_number}}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">✅ PAID</span></p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            Keep this receipt for your records. If you have any questions about this payment, please contact us.
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>Questions? Contact us at {{support_email}}</p>
          <p>© {{current_year}} {{business_name}}. All rights reserved.</p>
        </div>
      </div>
    `,
    text_template: `💳 Payment Receipt\nTransaction #{{transaction_id}}\n\nHi {{customer_name}},\n\nYour payment has been successfully processed. Here's your receipt for your records.\n\n💰 Payment Details:\nAmount Paid: {{amount}}\nPayment Method: {{payment_method}}\nTransaction Date: {{payment_date}}\nOrder Number: {{order_number}}\nStatus: ✅ PAID\n\nKeep this receipt for your records. If you have any questions about this payment, please contact us.\n\nQuestions? Contact us at {{support_email}}\n© {{current_year}} {{business_name}}. All rights reserved.`,
    variables: ['business_name', 'customer_name', 'transaction_id', 'amount', 'payment_method', 'payment_date', 'order_number', 'support_email', 'current_year'],
    template_type: 'transactional',
    category: 'payments',
    style: 'modern',
    is_active: true,
    full_html: true
  },
  {
    template_key: 'password_reset',
    template_name: 'Password Reset',
    subject_template: 'Reset your {{business_name}} password',
    html_template: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="background: #dc3545; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">🔐 Password Reset</h1>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #333; font-size: 20px; margin-top: 0;">Hi {{customer_name}},</h2>
          <p style="color: #666; line-height: 1.6;">
            We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{reset_url}}" style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 500;">
              Reset My Password
            </a>
          </div>
          <p style="color: #666; line-height: 1.6;">
            This link will expire in {{expiry_hours}} hours for your security.
          </p>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="{{reset_url}}" style="color: #dc3545;">{{reset_url}}</a>
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>If you didn't request this, please contact us at {{support_email}}</p>
          <p>© {{current_year}} {{business_name}}. All rights reserved.</p>
        </div>
      </div>
    `,
    text_template: `🔐 Password Reset\n\nHi {{customer_name}},\n\nWe received a request to reset your password. If you didn't make this request, you can safely ignore this email.\n\nReset your password: {{reset_url}}\n\nThis link will expire in {{expiry_hours}} hours for your security.\n\nIf you didn't request this, please contact us at {{support_email}}\n© {{current_year}} {{business_name}}. All rights reserved.`,
    variables: ['business_name', 'customer_name', 'reset_url', 'expiry_hours', 'support_email', 'current_year'],
    template_type: 'transactional',
    category: 'auth',
    style: 'modern',
    is_active: true,
    full_html: true
  },
  {
    template_key: 'cart_abandoned_reminder',
    template_name: 'Cart Abandonment Reminder',
    subject_template: "Don't forget your items at {{business_name}}!",
    html_template: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="background: #fd7e14; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">🛒 You left something behind!</h1>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #333; font-size: 20px; margin-top: 0;">Hi {{customer_name}},</h2>
          <p style="color: #666; line-height: 1.6;">
            We noticed you left some amazing items in your cart. Don't miss out on these great products!
          </p>
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #856404;">🛍️ Your Cart Items</h3>
            <p style="margin: 5px 0; color: #856404;">{{cart_items}}</p>
            <p style="margin: 15px 0 5px 0; color: #856404;"><strong>Total: {{cart_total}}</strong></p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{checkout_url}}" style="background: #fd7e14; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 500;">
              Complete Your Order
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            This cart will be saved for {{cart_expiry_days}} days. After that, items may become unavailable.
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>Questions? Contact us at {{support_email}}</p>
          <p><a href="{{unsubscribe_url}}" style="color: #666;">Unsubscribe from cart reminders</a></p>
          <p>© {{current_year}} {{business_name}}. All rights reserved.</p>
        </div>
      </div>
    `,
    text_template: `🛒 You left something behind!\n\nHi {{customer_name}},\n\nWe noticed you left some amazing items in your cart. Don't miss out on these great products!\n\n🛍️ Your Cart Items:\n{{cart_items}}\nTotal: {{cart_total}}\n\nComplete your order: {{checkout_url}}\n\nThis cart will be saved for {{cart_expiry_days}} days. After that, items may become unavailable.\n\nQuestions? Contact us at {{support_email}}\nUnsubscribe: {{unsubscribe_url}}\n© {{current_year}} {{business_name}}. All rights reserved.`,
    variables: ['business_name', 'customer_name', 'cart_items', 'cart_total', 'checkout_url', 'cart_expiry_days', 'support_email', 'unsubscribe_url', 'current_year'],
    template_type: 'marketing',
    category: 'cart',
    style: 'modern',
    is_active: true,
    full_html: true
  },
  {
    template_key: 'smtp_test',
    template_name: 'SMTP Test Email',
    subject_template: 'SMTP Test - {{test_timestamp}}',
    html_template: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="background: #20c997; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">✅ SMTP Test Successful!</h1>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <p style="color: #666; line-height: 1.6;">
            Congratulations! Your SMTP configuration is working correctly.
          </p>
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #0c5460;">📊 Test Details</h3>
            <p style="margin: 5px 0; color: #0c5460;"><strong>Test Time:</strong> {{test_timestamp}}</p>
            <p style="margin: 5px 0; color: #0c5460;"><strong>SMTP Provider:</strong> {{smtp_provider}}</p>
            <p style="margin: 5px 0; color: #0c5460;"><strong>From Email:</strong> {{from_email}}</p>
            <p style="margin: 5px 0; color: #0c5460;"><strong>Status:</strong> <span style="color: #28a745;">✅ Delivered</span></p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            Your email system is ready to send transactional and marketing emails.
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>This is an automated test email from {{business_name}}</p>
        </div>
      </div>
    `,
    text_template: `✅ SMTP Test Successful!\n\nCongratulations! Your SMTP configuration is working correctly.\n\n📊 Test Details:\nTest Time: {{test_timestamp}}\nSMTP Provider: {{smtp_provider}}\nFrom Email: {{from_email}}\nStatus: ✅ Delivered\n\nYour email system is ready to send transactional and marketing emails.\n\nThis is an automated test email from {{business_name}}`,
    variables: ['business_name', 'test_timestamp', 'smtp_provider', 'from_email'],
    template_type: 'transactional',
    category: 'system',
    style: 'modern',
    is_active: true,
    full_html: true
  }
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🌱 Starting email template seeding process...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      created: [],
      updated: [],
      skipped: [],
      errors: []
    };

    // Process each template
    for (const template of PRODUCTION_TEMPLATES) {
      try {
        console.log(`Processing template: ${template.template_key}`);

        // Check if template already exists
        const { data: existing } = await supabase
          .from('enhanced_email_templates')
          .select('id, template_key, updated_at')
          .eq('template_key', template.template_key)
          .maybeSingle();

        if (existing) {
          // Update existing template
          const { error: updateError } = await supabase
            .from('enhanced_email_templates')
            .update({
              template_name: template.template_name,
              subject_template: template.subject_template,
              html_template: template.html_template,
              text_template: template.text_template,
              variables: template.variables,
              template_type: template.template_type,
              category: template.category,
              style: template.style,
              is_active: template.is_active,
              full_html: template.full_html,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;

          results.updated.push({
            template_key: template.template_key,
            name: template.template_name,
            id: existing.id
          });
          console.log(`✅ Updated: ${template.template_key}`);
        } else {
          // Create new template
          const { data: created, error: createError } = await supabase
            .from('enhanced_email_templates')
            .insert({
              template_key: template.template_key,
              template_name: template.template_name,
              subject_template: template.subject_template,
              html_template: template.html_template,
              text_template: template.text_template,
              variables: template.variables,
              template_type: template.template_type,
              category: template.category,
              style: template.style,
              is_active: template.is_active,
              full_html: template.full_html
            })
            .select('id')
            .single();

          if (createError) throw createError;

          results.created.push({
            template_key: template.template_key,
            name: template.template_name,
            id: created.id
          });
          console.log(`🆕 Created: ${template.template_key}`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${template.template_key}:`, error);
        results.errors.push({
          template_key: template.template_key,
          error: error.message
        });
      }
    }

    const summary = {
      success: true,
      message: `Seeded ${results.created.length + results.updated.length} templates successfully`,
      statistics: {
        created: results.created.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        total_processed: PRODUCTION_TEMPLATES.length
      },
      details: results,
      timestamp: new Date().toISOString()
    };

    console.log('🎉 Template seeding completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 200
    });

  } catch (error) {
    console.error('❌ Template seeding failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 500
    });
  }
});