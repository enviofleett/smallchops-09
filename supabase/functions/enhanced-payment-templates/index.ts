import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced professional payment confirmation email templates
const ENHANCED_PAYMENT_TEMPLATES = {
  payment_confirmation: {
    template_key: 'payment_confirmation',
    template_name: 'Enhanced Payment Confirmation',
    subject_template: '✅ Payment Confirmed - Order {{order_number}} | {{store_name}}',
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmed</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; padding: 40px 32px; text-align: center; }
        .success-icon { width: 64px; height: 64px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 32px; }
        .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .header p { font-size: 16px; opacity: 0.9; }
        
        .content { padding: 40px 32px; }
        .payment-summary { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 12px; padding: 24px; margin: 24px 0; }
        .payment-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .payment-row:last-child { margin-bottom: 0; font-weight: 600; font-size: 18px; padding-top: 12px; border-top: 1px solid #d1fae5; }
        .payment-label { color: #374151; }
        .payment-value { color: #065f46; font-weight: 500; }
        .payment-total { color: #065f46; }
        
        .order-details { background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; }
        .order-details h3 { color: #1f2937; margin-bottom: 16px; font-size: 18px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .detail-label { color: #6b7280; }
        .detail-value { color: #374151; font-weight: 500; }
        
        .next-steps { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0; }
        .next-steps h3 { color: #1e40af; margin-bottom: 12px; }
        .next-steps ul { padding-left: 20px; color: #374151; }
        .next-steps li { margin-bottom: 8px; }
        
        .cta-section { text-align: center; margin: 32px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: transform 0.2s; }
        .cta-button:hover { transform: translateY(-2px); }
        
        .support-section { background: #fafafa; padding: 24px; margin: 24px 0; border-radius: 8px; text-align: center; }
        .support-section h4 { color: #374151; margin-bottom: 12px; }
        .support-contacts { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; }
        .support-contact { color: #6b7280; text-decoration: none; font-size: 14px; }
        
        .footer { background: #f3f4f6; padding: 32px; text-align: center; color: #6b7280; }
        .footer-links { margin: 16px 0; }
        .footer-links a { color: #6b7280; text-decoration: none; margin: 0 12px; font-size: 14px; }
        .social-links { margin: 16px 0; }
        .social-links a { color: #9ca3af; margin: 0 8px; text-decoration: none; }
        
        @media (max-width: 600px) {
            .container { margin: 0; }
            .header, .content { padding: 24px 20px; }
            .payment-row, .detail-row { flex-direction: column; align-items: flex-start; }
            .payment-value, .detail-value { margin-top: 4px; }
            .support-contacts { flex-direction: column; gap: 8px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">✓</div>
            <h1>Payment Confirmed!</h1>
            <p>Thank you for your payment, {{customer_name}}</p>
        </div>
        
        <div class="content">
            <div class="payment-summary">
                <div class="payment-row">
                    <span class="payment-label">Order Number</span>
                    <span class="payment-value">{{order_number}}</span>
                </div>
                <div class="payment-row">
                    <span class="payment-label">Payment Amount</span>
                    <span class="payment-value">{{payment_amount}}</span>
                </div>
                <div class="payment-row">
                    <span class="payment-label">Payment Method</span>
                    <span class="payment-value">{{payment_method}}</span>
                </div>
                <div class="payment-row">
                    <span class="payment-label">Transaction Reference</span>
                    <span class="payment-value">{{payment_reference}}</span>
                </div>
                <div class="payment-row">
                    <span class="payment-label payment-total">Order Total</span>
                    <span class="payment-value payment-total">{{order_total}}</span>
                </div>
            </div>
            
            <div class="order-details">
                <h3>Order Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Order Date</span>
                    <span class="detail-value">{{order_date}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Customer Email</span>
                    <span class="detail-value">{{customer_email}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Fulfillment Type</span>
                    <span class="detail-value">{{fulfillment_type}}</span>
                </div>
            </div>
            
            <div class="next-steps">
                <h3>What's Next?</h3>
                <ul>
                    <li>Your order is now confirmed and being processed</li>
                    <li>You'll receive an update when your order is being prepared</li>
                    <li>We'll notify you when it's ready for pickup/delivery</li>
                    <li>Keep this email for your records</li>
                </ul>
            </div>
            
            <div class="cta-section">
                <a href="{{store_url}}" class="cta-button">Continue Shopping</a>
            </div>
            
            <div class="support-section">
                <h4>Need Help?</h4>
                <div class="support-contacts">
                    <a href="mailto:{{support_email}}" class="support-contact">Email Support</a>
                    <a href="tel:{{support_phone}}" class="support-contact">Call Us</a>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>{{store_name}}</strong></p>
            <div class="footer-links">
                <a href="{{store_url}}">Website</a>
                <a href="{{store_url}}/privacy">Privacy Policy</a>
                <a href="{{store_url}}/terms">Terms of Service</a>
            </div>
            <p>&copy; 2024 {{store_name}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `✅ PAYMENT CONFIRMED - Order {{order_number}}

Hello {{customer_name}},

Your payment has been successfully processed!

PAYMENT DETAILS:
• Order Number: {{order_number}}
• Payment Amount: {{payment_amount}}
• Payment Method: {{payment_method}}
• Transaction Reference: {{payment_reference}}
• Order Total: {{order_total}}

ORDER INFORMATION:
• Order Date: {{order_date}}
• Customer Email: {{customer_email}}
• Fulfillment Type: {{fulfillment_type}}

WHAT'S NEXT:
1. Your order is now confirmed and being processed
2. You'll receive updates as your order progresses
3. We'll notify you when it's ready for pickup/delivery
4. Keep this email for your records

Continue shopping: {{store_url}}

Need help? Contact us at {{support_email}} or {{support_phone}}

Thank you for choosing {{store_name}}!`,
    template_type: 'transactional',
    is_active: true,
    variables: [
      'customer_name', 'order_number', 'payment_amount', 'payment_method', 
      'payment_reference', 'order_total', 'order_date', 'customer_email', 
      'fulfillment_type', 'store_name', 'store_url', 'support_email', 'support_phone'
    ]
  },

  admin_new_order: {
    template_key: 'admin_new_order',
    template_name: 'Enhanced Admin Order Notification',
    subject_template: '🔔 New Order Alert: {{order_number}} - {{payment_amount}} | {{store_name}}',
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Order Alert</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; padding: 32px 24px; text-align: center; }
        .alert-icon { width: 48px; height: 48px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px; }
        .content { padding: 24px; }
        .order-card { background: #fff7ed; border: 2px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .order-row { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .order-row:last-child { margin-bottom: 0; font-weight: 600; padding-top: 12px; border-top: 1px solid #fed7aa; }
        .customer-info { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .action-buttons { text-align: center; margin: 24px 0; }
        .btn { display: inline-block; padding: 12px 24px; margin: 8px; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .btn-primary { background: #3b82f6; color: #ffffff; }
        .btn-secondary { background: #6b7280; color: #ffffff; }
        .footer { background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="alert-icon">🔔</div>
            <h1>New Order Received</h1>
            <p>Order {{order_number}} • {{order_date}}</p>
        </div>
        
        <div class="content">
            <div class="order-card">
                <div class="order-row">
                    <span>Order Number</span>
                    <strong>{{order_number}}</strong>
                </div>
                <div class="order-row">
                    <span>Order Total</span>
                    <strong>{{order_total}}</strong>
                </div>
                <div class="order-row">
                    <span>Payment Amount</span>
                    <strong>{{payment_amount}}</strong>
                </div>
                <div class="order-row">
                    <span>Payment Method</span>
                    <strong>{{payment_method}}</strong>
                </div>
                <div class="order-row">
                    <span>Fulfillment Type</span>
                    <strong>{{fulfillment_type}}</strong>
                </div>
            </div>
            
            <div class="customer-info">
                <h3>Customer Information</h3>
                <p><strong>Name:</strong> {{customer_name}}</p>
                <p><strong>Email:</strong> {{customer_email}}</p>
                <p><strong>Order Date:</strong> {{order_date}}</p>
            </div>
            
            <div class="action-buttons">
                <a href="{{store_url}}/admin/orders/{{order_number}}" class="btn btn-primary">View Order Details</a>
                <a href="{{store_url}}/admin/orders" class="btn btn-secondary">All Orders</a>
            </div>
        </div>
        
        <div class="footer">
            <p>{{store_name}} Admin Dashboard</p>
            <p>This is an automated notification for new orders.</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `🔔 NEW ORDER ALERT

Order: {{order_number}}
Total: {{order_total}}
Payment: {{payment_amount}} via {{payment_method}}
Date: {{order_date}}

CUSTOMER:
{{customer_name}} ({{customer_email}})

Fulfillment: {{fulfillment_type}}

View order: {{store_url}}/admin/orders/{{order_number}}

{{store_name}} Admin`,
    template_type: 'transactional',
    is_active: true,
    variables: [
      'order_number', 'order_total', 'payment_amount', 'payment_method',
      'fulfillment_type', 'customer_name', 'customer_email', 'order_date',
      'store_name', 'store_url'
    ]
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { template_keys } = await req.json();
    const templatesToCreate = template_keys || Object.keys(ENHANCED_PAYMENT_TEMPLATES);

    console.log('Creating enhanced payment templates:', templatesToCreate);

    const results = [];

    for (const templateKey of templatesToCreate) {
      const template = ENHANCED_PAYMENT_TEMPLATES[templateKey];
      
      if (!template) {
        console.warn(`Template not found: ${templateKey}`);
        continue;
      }

      // Check if template already exists and update it
      const { data: existing } = await supabaseAdmin
        .from('enhanced_email_templates')
        .select('id')
        .eq('template_key', templateKey)
        .single();

      if (existing) {
        // Update existing template
        const { data: updated, error } = await supabaseAdmin
          .from('enhanced_email_templates')
          .update(template)
          .eq('template_key', templateKey)
          .select()
          .single();

        if (error) {
          console.error(`Failed to update template ${templateKey}:`, error);
          results.push({ template_key: templateKey, status: 'update_error', error: error.message });
        } else {
          console.log(`Updated template ${templateKey} successfully`);
          results.push({ template_key: templateKey, status: 'updated', id: updated.id });
        }
      } else {
        // Create new template
        const { data: created, error } = await supabaseAdmin
          .from('enhanced_email_templates')
          .insert(template)
          .select()
          .single();

        if (error) {
          console.error(`Failed to create template ${templateKey}:`, error);
          results.push({ template_key: templateKey, status: 'create_error', error: error.message });
        } else {
          console.log(`Created template ${templateKey} successfully`);
          results.push({ template_key: templateKey, status: 'created', id: created.id });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Enhanced payment templates processed',
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Enhanced payment template generator error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to generate enhanced payment templates'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});