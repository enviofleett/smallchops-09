import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Mail, 
  CheckCircle2,
  AlertTriangle,
  Plus,
  Database
} from 'lucide-react';

interface EmailTemplate {
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template: string;
  variables: string[];
  template_type: string;
  category: string;
  style: string;
  is_active: boolean;
}

const criticalTemplates: EmailTemplate[] = [
  {
    template_key: 'order_confirmed',
    template_name: 'Order Confirmation',
    subject_template: 'Order Confirmed - {{order_number}}',
    html_template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmed</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
        .order-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .amount { font-size: 24px; font-weight: bold; color: #10b981; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Order Confirmed!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for your order</p>
        </div>
        <div class="content">
            <p>Hi {{customer_name}},</p>
            <p>Great news! We've received and confirmed your order. Here are the details:</p>
            
            <div class="order-details">
                <h3 style="margin-top: 0;">Order Details</h3>
                <p><strong>Order Number:</strong> {{order_number}}</p>
                <p><strong>Total Amount:</strong> <span class="amount">₦{{total_amount}}</span></p>
                <p><strong>Status:</strong> Confirmed & Being Prepared</p>
            </div>
            
            <p>We'll notify you once your order is ready for {{order_type}}. Expected time: 30-45 minutes.</p>
            
            <p>If you have any questions, feel free to contact us.</p>
            
            <p>Thank you for choosing us!</p>
            <p>{{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>{{business_name}} | {{business_phone}} | {{business_email}}</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `Order Confirmed - {{order_number}}

Hi {{customer_name}},

Great news! We've received and confirmed your order.

Order Details:
- Order Number: {{order_number}}
- Total Amount: ₦{{total_amount}}
- Status: Confirmed & Being Prepared

We'll notify you once your order is ready for {{order_type}}. Expected time: 30-45 minutes.

Thank you for choosing {{business_name}}!

{{business_name}} Team
{{business_phone}} | {{business_email}}`,
    variables: ['customer_name', 'order_number', 'total_amount', 'order_type', 'business_name', 'business_phone', 'business_email'],
    template_type: 'transactional',
    category: 'order',
    style: 'professional',
    is_active: true
  },
  {
    template_key: 'order_out_for_delivery',
    template_name: 'Order Out for Delivery',
    subject_template: 'Your order is on the way! - {{order_number}}',
    html_template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Out for Delivery</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
        .delivery-info { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .tracking { text-align: center; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🚚 On the Way!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your order is out for delivery</p>
        </div>
        <div class="content">
            <p>Hi {{customer_name}},</p>
            <p>Exciting news! Your order <strong>{{order_number}}</strong> is now out for delivery and heading your way.</p>
            
            <div class="delivery-info">
                <h3 style="margin-top: 0;">🎯 Delivery Information</h3>
                <p><strong>Delivery Address:</strong><br>{{delivery_address}}</p>
                <p><strong>Estimated Arrival:</strong> {{estimated_delivery_time}}</p>
                <p><strong>Driver Contact:</strong> {{driver_phone}}</p>
            </div>
            
            <div class="tracking">
                <p><strong>Track your order:</strong> {{order_number}}</p>
            </div>
            
            <p><strong>Please ensure someone is available to receive the delivery.</strong></p>
            
            <p>If you have any questions or need to reschedule, please contact us immediately.</p>
            
            <p>Thank you for your patience!</p>
            <p>{{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>{{business_name}} | {{business_phone}} | {{business_email}}</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `Your order is on the way! - {{order_number}}

Hi {{customer_name}},

Exciting news! Your order {{order_number}} is now out for delivery and heading your way.

Delivery Information:
- Delivery Address: {{delivery_address}}
- Estimated Arrival: {{estimated_delivery_time}}
- Driver Contact: {{driver_phone}}

Please ensure someone is available to receive the delivery.

If you have any questions or need to reschedule, please contact us immediately.

Thank you for your patience!
{{business_name}} Team
{{business_phone}} | {{business_email}}`,
    variables: ['customer_name', 'order_number', 'delivery_address', 'estimated_delivery_time', 'driver_phone', 'business_name', 'business_phone', 'business_email'],
    template_type: 'transactional',
    category: 'delivery',
    style: 'professional',
    is_active: true
  },
  {
    template_key: 'order_delivered',
    template_name: 'Order Delivered',
    subject_template: '✅ Order Delivered - {{order_number}}',
    html_template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Delivered</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
        .success-box { background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; text-align: center; }
        .feedback-section { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">✅ Delivered!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your order has been successfully delivered</p>
        </div>
        <div class="content">
            <p>Hi {{customer_name}},</p>
            
            <div class="success-box">
                <h3 style="margin-top: 0; color: #065f46;">🎉 Order Successfully Delivered!</h3>
                <p><strong>Order {{order_number}}</strong> has been delivered to:</p>
                <p>{{delivery_address}}</p>
                <p><strong>Delivered at:</strong> {{delivery_time}}</p>
            </div>
            
            <p>We hope you enjoy your order! If there are any issues with your delivery, please contact us within the next 2 hours.</p>
            
            <div class="feedback-section">
                <h4 style="margin-top: 0;">📝 How was your experience?</h4>
                <p>We'd love to hear your feedback! Your opinion helps us improve our service.</p>
                <p><strong>Rate your experience:</strong> [Leave feedback here - {{feedback_link}}]</p>
            </div>
            
            <p>Thank you for choosing {{business_name}}. We look forward to serving you again!</p>
            
            <p>Best regards,</p>
            <p>{{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>{{business_name}} | {{business_phone}} | {{business_email}}</p>
            <p>Follow us for updates and special offers!</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `✅ Order Delivered - {{order_number}}

Hi {{customer_name}},

Great news! Your order {{order_number}} has been successfully delivered to:
{{delivery_address}}

Delivered at: {{delivery_time}}

We hope you enjoy your order! If there are any issues with your delivery, please contact us within the next 2 hours.

How was your experience?
We'd love to hear your feedback! Rate your experience: {{feedback_link}}

Thank you for choosing {{business_name}}. We look forward to serving you again!

Best regards,
{{business_name}} Team
{{business_phone}} | {{business_email}}`,
    variables: ['customer_name', 'order_number', 'delivery_address', 'delivery_time', 'feedback_link', 'business_name', 'business_phone', 'business_email'],
    template_type: 'transactional',
    category: 'delivery',
    style: 'professional',
    is_active: true
  },
  {
    template_key: 'order_ready',
    template_name: 'Order Ready for Pickup',
    subject_template: '🔔 Your order is ready for pickup - {{order_number}}',
    html_template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Ready</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
        .pickup-info { background: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
        .urgent { background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🔔 Ready for Pickup!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your order is prepared and waiting</p>
        </div>
        <div class="content">
            <p>Hi {{customer_name}},</p>
            <p>Great news! Your order <strong>{{order_number}}</strong> is ready for pickup.</p>
            
            <div class="pickup-info">
                <h3 style="margin-top: 0;">📍 Pickup Information</h3>
                <p><strong>Pickup Location:</strong><br>{{pickup_address}}</p>
                <p><strong>Business Hours:</strong> {{business_hours}}</p>
                <p><strong>Order Total:</strong> ₦{{total_amount}}</p>
            </div>
            
            <div class="urgent">
                <h4 style="margin-top: 0; color: #dc2626;">⏰ Important Pickup Instructions</h4>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Please bring this email or your order number</li>
                    <li>Have your payment ready if not already paid</li>
                    <li>Orders not collected within 2 hours may need to be reheated</li>
                </ul>
            </div>
            
            <p><strong>Order Reference:</strong> {{order_number}}</p>
            <p><strong>Contact for Pickup:</strong> {{business_phone}}</p>
            
            <p>Thank you for your order! We look forward to seeing you soon.</p>
            
            <p>Best regards,</p>
            <p>{{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>{{business_name}} | {{pickup_address}}</p>
            <p>{{business_phone}} | {{business_email}}</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `🔔 Your order is ready for pickup - {{order_number}}

Hi {{customer_name}},

Great news! Your order {{order_number}} is ready for pickup.

Pickup Information:
- Location: {{pickup_address}}
- Business Hours: {{business_hours}}
- Order Total: ₦{{total_amount}}

Important Pickup Instructions:
- Please bring this email or your order number
- Have your payment ready if not already paid
- Orders not collected within 2 hours may need to be reheated

Contact for Pickup: {{business_phone}}

Thank you for your order! We look forward to seeing you soon.

Best regards,
{{business_name}} Team
{{business_phone}} | {{business_email}}`,
    variables: ['customer_name', 'order_number', 'pickup_address', 'business_hours', 'total_amount', 'business_name', 'business_phone', 'business_email'],
    template_type: 'transactional',
    category: 'pickup',
    style: 'professional',
    is_active: true
  },
  {
    template_key: 'customer_welcome',
    template_name: 'Customer Welcome Email',
    subject_template: 'Welcome to {{business_name}}! 🎉',
    html_template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
        .welcome-box { background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        .benefits { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 32px;">Welcome to {{business_name}}! 🎉</h1>
            <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">We're thrilled to have you with us</p>
        </div>
        <div class="content">
            <div class="welcome-box">
                <h2 style="margin-top: 0; color: #1e40af;">Hi {{customer_name}},</h2>
                <p>Welcome to the {{business_name}} family! We're excited to serve you the best food experience.</p>
            </div>
            
            <div class="benefits">
                <h3 style="margin-top: 0;">🌟 What you can expect:</h3>
                <ul style="margin: 15px 0; padding-left: 20px;">
                    <li><strong>Fresh, Quality Food:</strong> Made with the finest ingredients</li>
                    <li><strong>Fast Delivery:</strong> Quick delivery to your doorstep</li>
                    <li><strong>Easy Ordering:</strong> Simple online ordering system</li>
                    <li><strong>Great Customer Service:</strong> We're here to help anytime</li>
                </ul>
            </div>
            
            <p><strong>Ready to place your first order?</strong></p>
            <p>Browse our menu and discover amazing flavors that will keep you coming back for more.</p>
            
            <p><strong>Need help?</strong> Contact us at {{business_phone}} or {{business_email}}. We're always happy to assist!</p>
            
            <p>Once again, welcome to {{business_name}}!</p>
            
            <p>Best regards,</p>
            <p>The {{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>{{business_name}} | {{business_phone}} | {{business_email}}</p>
            <p>{{business_address}}</p>
            <p>Follow us on social media for updates and special offers!</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `Welcome to {{business_name}}! 🎉

Hi {{customer_name}},

Welcome to the {{business_name}} family! We're excited to serve you the best food experience.

What you can expect:
- Fresh, Quality Food: Made with the finest ingredients
- Fast Delivery: Quick delivery to your doorstep  
- Easy Ordering: Simple online ordering system
- Great Customer Service: We're here to help anytime

Ready to place your first order?
Browse our menu and discover amazing flavors that will keep you coming back for more.

Need help? Contact us at {{business_phone}} or {{business_email}}. We're always happy to assist!

Once again, welcome to {{business_name}}!

Best regards,
The {{business_name}} Team

{{business_name}} | {{business_phone}} | {{business_email}}
{{business_address}}`,
    variables: ['customer_name', 'business_name', 'business_phone', 'business_email', 'business_address'],
    template_type: 'transactional',
    category: 'onboarding',
    style: 'friendly',
    is_active: true
  },
  {
    template_key: 'payment_confirmed',
    template_name: 'Payment Confirmation',
    subject_template: '✅ Payment Confirmed - {{order_number}}',
    html_template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmed</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #059669, #047857); color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
        .payment-details { background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
        .amount { font-size: 24px; font-weight: bold; color: #059669; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">✅ Payment Confirmed!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your payment has been successfully processed</p>
        </div>
        <div class="content">
            <p>Hi {{customer_name}},</p>
            <p>Great news! We have successfully received your payment for order <strong>{{order_number}}</strong>.</p>
            
            <div class="payment-details">
                <h3 style="margin-top: 0;">💳 Payment Details</h3>
                <p><strong>Order Number:</strong> {{order_number}}</p>
                <p><strong>Amount Paid:</strong> <span class="amount">₦{{amount_paid}}</span></p>
                <p><strong>Payment Method:</strong> {{payment_method}}</p>
                <p><strong>Transaction ID:</strong> {{transaction_id}}</p>
                <p><strong>Payment Date:</strong> {{payment_date}}</p>
            </div>
            
            <p><strong>What's next?</strong></p>
            <ul>
                <li>Your order is now being prepared</li>
                <li>You'll receive updates via email and SMS</li>
                <li>Estimated preparation time: 30-45 minutes</li>
            </ul>
            
            <p>Keep this email as your receipt. If you have any questions about your payment, please contact us with your transaction ID.</p>
            
            <p>Thank you for your business!</p>
            <p>{{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>{{business_name}} | {{business_phone}} | {{business_email}}</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `✅ Payment Confirmed - {{order_number}}

Hi {{customer_name}},

Great news! We have successfully received your payment for order {{order_number}}.

Payment Details:
- Order Number: {{order_number}}
- Amount Paid: ₦{{amount_paid}}
- Payment Method: {{payment_method}}
- Transaction ID: {{transaction_id}}
- Payment Date: {{payment_date}}

What's next?
- Your order is now being prepared
- You'll receive updates via email and SMS
- Estimated preparation time: 30-45 minutes

Keep this email as your receipt. If you have any questions about your payment, please contact us with your transaction ID.

Thank you for your business!
{{business_name}} Team
{{business_phone}} | {{business_email}}`,
    variables: ['customer_name', 'order_number', 'amount_paid', 'payment_method', 'transaction_id', 'payment_date', 'business_name', 'business_phone', 'business_email'],
    template_type: 'transactional',
    category: 'payment',
    style: 'professional',
    is_active: true
  }
];

export const ProductionTemplateSeeder: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const checkExistingTemplates = async () => {
    try {
      const { data: templates } = await (supabase as any)
        .from('enhanced_email_templates')
        .select('template_key')
        .in('template_key', criticalTemplates.map(t => t.template_key));
      
      const existingKeys = templates?.map(t => t.template_key) || [];
      const status: Record<string, boolean> = {};
      
      criticalTemplates.forEach(template => {
        status[template.template_key] = existingKeys.includes(template.template_key);
      });
      
      setTemplateStatus(status);
    } catch (error) {
      console.error('Error checking templates:', error);
    }
  };

  const seedAllTemplates = async () => {
    setIsLoading(true);
    try {
      let createdCount = 0;
      let skippedCount = 0;

      for (const template of criticalTemplates) {
        // Check if template already exists
        const { data: existing } = await (supabase as any)
          .from('enhanced_email_templates')
          .select('id')
          .eq('template_key', template.template_key)
          .maybeSingle();

        if (existing) {
          skippedCount++;
          continue;
        }

        // Create the template
        const { error } = await (supabase as any)
          .from('enhanced_email_templates')
          .insert([template]);

        if (error) {
          console.error(`Failed to create template ${template.template_key}:`, error);
        } else {
          createdCount++;
        }
      }

      await checkExistingTemplates();

      toast({
        title: "Template Seeding Complete",
        description: `Created ${createdCount} templates, skipped ${skippedCount} existing ones`,
      });
    } catch (error: any) {
      console.error('Error seeding templates:', error);
      toast({
        title: "Seeding Failed",
        description: error.message || "Failed to seed email templates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const seedSingleTemplate = async (template: EmailTemplate) => {
    try {
      const { error } = await (supabase as any)
        .from('enhanced_email_templates')
        .insert([template]);

      if (error) throw error;

      await checkExistingTemplates();
      
      toast({
        title: "Template Created",
        description: `Template "${template.template_name}" created successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    }
  };

  React.useEffect(() => {
    checkExistingTemplates();
  }, []);

  const missingTemplates = criticalTemplates.filter(t => !templateStatus[t.template_key]);
  const existingTemplates = criticalTemplates.filter(t => templateStatus[t.template_key]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Production Email Templates Seeder
              </CardTitle>
              <CardDescription>
                Seed critical email templates required for production deployment
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant={missingTemplates.length === 0 ? "default" : "destructive"}>
                {existingTemplates.length}/{criticalTemplates.length} Ready
              </Badge>
              <Button 
                onClick={seedAllTemplates} 
                disabled={isLoading || missingTemplates.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isLoading ? 'Seeding...' : `Seed All Missing (${missingTemplates.length})`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {missingTemplates.length === 0 ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                ✅ All critical email templates are configured and ready for production!
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                🚨 <strong>{missingTemplates.length} critical templates missing.</strong> These are required for production email functionality.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Template Status Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {criticalTemplates.map((template) => {
          const exists = templateStatus[template.template_key];
          return (
            <Card key={template.template_key} className={exists ? 'border-green-200' : 'border-red-200'}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{template.template_name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {exists ? (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Missing
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    <span className="text-muted-foreground">
                      Key: <code>{template.template_key}</code>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">
                      Subject: {template.subject_template}
                    </span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Variables: {template.variables.join(', ')}
                  </div>
                  
                  {!exists && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => seedSingleTemplate(template)}
                      className="mt-2 w-full"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create Template
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Production Template Requirements</CardTitle>
          <CardDescription>
            Why these templates are critical for production deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium">🔒 Production Mode Enforcement</h4>
              <p className="text-muted-foreground mt-1">
                When <code>EMAIL_PRODUCTION_MODE=true</code>, all emails MUST use these templates. 
                No fallback or ad-hoc emails are allowed to ensure brand consistency and security.
              </p>
            </div>
            
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium">📧 Customer Experience</h4>
              <p className="text-muted-foreground mt-1">
                These templates cover the complete order lifecycle: confirmation, preparation, 
                delivery/pickup, and payment. Missing any template will cause email failures.
              </p>
            </div>
            
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium">🎨 Professional Branding</h4>
              <p className="text-muted-foreground mt-1">
                Each template includes responsive design, consistent branding, and all necessary 
                variable placeholders for dynamic content.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};