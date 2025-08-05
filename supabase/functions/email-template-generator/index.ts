import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email templates for the missing ones
const EMAIL_TEMPLATES = {
  admin_new_order: {
    template_key: 'admin_new_order',
    template_name: 'Admin New Order Notification',
    subject_template: 'New Order Received: {{orderNumber}}',
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Order Notification</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: #2d3748; color: #ffffff; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .order-info { background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3182ce; }
        .btn { display: inline-block; background: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 24px; text-align: center; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Order Alert</h1>
        </div>
        
        <div class="content">
            <h2>Order #{{orderNumber}}</h2>
            
            <div class="order-info">
                <h3>Customer Information</h3>
                <p><strong>Name:</strong> {{customerName}}</p>
                <p><strong>Email:</strong> {{customerEmail}}</p>
                <p><strong>Order Total:</strong> {{orderTotal}}</p>
                <p><strong>Date:</strong> {{orderDate}}</p>
                <p><strong>Items Count:</strong> {{itemsCount}}</p>
            </div>
            
            <a href="{{adminDashboardLink}}" class="btn">View Order Details</a>
        </div>
        
        <div class="footer">
            <p>{{companyName}} Admin Panel</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `New Order Alert - Order #{{orderNumber}}

Customer: {{customerName}}
Email: {{customerEmail}}
Total: {{orderTotal}}
Date: {{orderDate}}
Items: {{itemsCount}}

View order details: {{adminDashboardLink}}

{{companyName}} Admin Panel`,
    template_type: 'transactional',
    is_active: true,
    variables: ['orderNumber', 'customerName', 'customerEmail', 'orderTotal', 'orderDate', 'itemsCount', 'adminDashboardLink', 'companyName']
  },

  customer_welcome: {
    template_key: 'customer_welcome',
    template_name: 'Customer Welcome Email',
    subject_template: 'Welcome to {{companyName}}!',
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: #ffffff; padding: 40px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .welcome-box { background: #f8fafc; padding: 24px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .btn { display: inline-block; background: #667eea; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
        .footer { background: #f8f9fa; padding: 24px; text-align: center; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to {{companyName}}!</h1>
        </div>
        
        <div class="content">
            <div class="welcome-box">
                <h2>Hello {{customerName}}!</h2>
                <p>Thank you for joining {{companyName}}. We're excited to have you as part of our community!</p>
                <a href="{{websiteUrl}}" class="btn">Start Shopping</a>
            </div>
            
            <p>If you have any questions, don't hesitate to contact our support team at {{supportEmail}}.</p>
        </div>
        
        <div class="footer">
            <p>© {{companyName}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
    text_template: `Welcome to {{companyName}}!

Hello {{customerName}}!

Thank you for joining {{companyName}}. We're excited to have you as part of our community!

Visit us: {{websiteUrl}}

If you have any questions, contact us at {{supportEmail}}.

© {{companyName}}. All rights reserved.`,
    template_type: 'transactional',
    is_active: true,
    variables: ['customerName', 'companyName', 'websiteUrl', 'supportEmail']
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
    const templatesToCreate = template_keys || Object.keys(EMAIL_TEMPLATES);

    console.log('Creating email templates:', templatesToCreate);

    const results = [];

    for (const templateKey of templatesToCreate) {
      const template = EMAIL_TEMPLATES[templateKey];
      
      if (!template) {
        console.warn(`Template not found: ${templateKey}`);
        continue;
      }

      // Check if template already exists
      const { data: existing } = await supabaseAdmin
        .from('enhanced_email_templates')
        .select('id')
        .eq('template_key', templateKey)
        .single();

      if (existing) {
        console.log(`Template ${templateKey} already exists, skipping`);
        results.push({ template_key: templateKey, status: 'exists' });
        continue;
      }

      // Create new template
      const { data: created, error } = await supabaseAdmin
        .from('enhanced_email_templates')
        .insert(template)
        .select()
        .single();

      if (error) {
        console.error(`Failed to create template ${templateKey}:`, error);
        results.push({ template_key: templateKey, status: 'error', error: error.message });
      } else {
        console.log(`Created template ${templateKey} successfully`);
        results.push({ template_key: templateKey, status: 'created', id: created.id });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email templates processed',
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Email template generator error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to generate email templates'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});