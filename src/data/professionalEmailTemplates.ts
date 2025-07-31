// Professional Email Templates with 4 Visual Styles
// Clean, Modern, Bold, Elegant designs for comprehensive e-commerce communication

export interface EmailTemplate {
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template: string;
  template_type: 'transactional' | 'marketing';
  variables: string[];
  category: 'order_confirmation' | 'shipping' | 'abandoned_cart' | 'welcome' | 'promotional';
  style: 'clean' | 'modern' | 'bold' | 'elegant';
}

export const professionalEmailTemplates: EmailTemplate[] = [
  // ORDER CONFIRMATION TEMPLATES (4 styles)
  {
    template_key: 'order_confirmation_clean',
    template_name: 'Order Confirmation - Clean Style',
    subject_template: 'Order Confirmation #{{orderNumber}} - Thank You!',
    category: 'order_confirmation',
    style: 'clean',
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'orderTotal', 'orderDate', 'deliveryAddress', 'companyName', 'supportEmail'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <h1 style="margin: 0; color: #1e293b; font-size: 28px; font-weight: 600;">Order Confirmed</h1>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 16px;">Thank you for your order, {{customerName}}!</p>
            </td>
          </tr>
          
          <!-- Order Details -->
          <tr>
            <td style="padding: 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px; background-color: #f1f5f9; border-radius: 6px;">
                    <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Order Details</h2>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
                      <tr>
                        <td style="padding: 4px 0; color: #64748b;">Order Number:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-weight: 500; text-align: right;">#{{orderNumber}}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #64748b;">Order Date:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-weight: 500; text-align: right;">{{orderDate}}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #64748b;">Total Amount:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-weight: 600; font-size: 16px; text-align: right;">${{orderTotal}}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #64748b;">Delivery Address:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-weight: 500; text-align: right;">{{deliveryAddress}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px;">
                We'll send you a shipping confirmation email with tracking information once your order has been dispatched.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Need help? Contact us at <a href="mailto:{{supportEmail}}" style="color: #3b82f6; text-decoration: none;">{{supportEmail}}</a>
              </p>
              <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">© {{companyName}}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `Order Confirmation #{{orderNumber}}

Hi {{customerName}},

Thank you for your order! Here are the details:

Order Number: #{{orderNumber}}
Order Date: {{orderDate}}
Total: ${{orderTotal}}
Delivery Address: {{deliveryAddress}}

We'll send you tracking information once your order ships.

Need help? Contact us at {{supportEmail}}

Best regards,
{{companyName}}`
  },

  {
    template_key: 'order_confirmation_modern',
    template_name: 'Order Confirmation - Modern Style',
    subject_template: '✨ Your Order #{{orderNumber}} is Confirmed!',
    category: 'order_confirmation',
    style: 'modern',
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'orderTotal', 'orderDate', 'deliveryAddress', 'companyName', 'supportEmail'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">
          <!-- Header with Gradient -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center; color: white;">
              <div style="width: 60px; height: 60px; margin: 0 auto 20px auto; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <div style="width: 24px; height: 24px; background: white; border-radius: 50%;"></div>
              </div>
              <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Order Confirmed!</h1>
              <p style="margin: 12px 0 0 0; font-size: 18px; opacity: 0.9;">Hey {{customerName}}, your order is on its way!</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 20px 0; color: white; font-size: 20px; font-weight: 600;">Order Summary</h2>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="color: white;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 16px; opacity: 0.9;">Order #{{orderNumber}}</td>
                    <td style="padding: 8px 0; font-size: 16px; text-align: right; font-weight: 600;">{{orderDate}}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 16px 0 8px 0; border-top: 1px solid rgba(255,255,255,0.3);">
                      <div style="font-size: 14px; opacity: 0.9;">Delivery Address</div>
                      <div style="font-size: 16px; font-weight: 500; margin-top: 4px;">{{deliveryAddress}}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 0 0 0; font-size: 18px; font-weight: 600;">Total</td>
                    <td style="padding: 16px 0 0 0; font-size: 24px; font-weight: 700; text-align: right;">${{orderTotal}}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; padding: 20px; background: #f8fafc; border-radius: 12px;">
                <p style="margin: 0; color: #64748b; font-size: 16px;">
                  🚀 We're preparing your order with care. You'll receive tracking details soon!
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #f8fafc; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Questions? We're here to help at <a href="mailto:{{supportEmail}}" style="color: #667eea; text-decoration: none; font-weight: 500;">{{supportEmail}}</a>
              </p>
              <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">© {{companyName}}. Made with ❤️</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `✨ Order Confirmed! #{{orderNumber}}

Hey {{customerName}},

Your order is on its way! 🚀

📦 Order Details:
- Order: #{{orderNumber}}
- Date: {{orderDate}}
- Total: ${{orderTotal}}
- Delivery: {{deliveryAddress}}

We're preparing your order with care. You'll receive tracking details soon!

Questions? Contact us at {{supportEmail}}

{{companyName}} Team ❤️`
  },

  {
    template_key: 'order_confirmation_bold',
    template_name: 'Order Confirmation - Bold Style',
    subject_template: '🔥 ORDER CONFIRMED #{{orderNumber}} - GET READY!',
    category: 'order_confirmation',
    style: 'bold',
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'orderTotal', 'orderDate', 'deliveryAddress', 'companyName', 'supportEmail'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 0; box-shadow: 0 0 40px rgba(255,0,100,0.3);">
          <!-- Bold Header -->
          <tr>
            <td style="padding: 0; background: linear-gradient(45deg, #ff0066, #ff3366); text-align: center; color: white; position: relative;">
              <div style="padding: 50px 40px; transform: skew(-2deg); margin: -10px 0;">
                <h1 style="margin: 0; font-size: 36px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">ORDER LOCKED IN!</h1>
                <div style="width: 80px; height: 4px; background: white; margin: 20px auto; border-radius: 2px;"></div>
                <p style="margin: 0; font-size: 20px; font-weight: 600; text-transform: uppercase;">{{customerName}} - YOU'RE ALL SET!</p>
              </div>
            </td>
          </tr>
          
          <!-- High Impact Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="border: 4px solid #ff0066; padding: 30px; margin-bottom: 30px; background: #000000; color: white; text-align: center;">
                <h2 style="margin: 0 0 20px 0; color: #ff0066; font-size: 24px; font-weight: 800; text-transform: uppercase;">ORDER #{{orderNumber}}</h2>
                <div style="font-size: 48px; font-weight: 900; color: #ffffff; margin: 20px 0;">${{orderTotal}}</div>
                <div style="background: #ff0066; padding: 15px; margin: 20px 0; transform: skew(-1deg);">
                  <div style="transform: skew(1deg); font-size: 16px; font-weight: 600;">{{orderDate}}</div>
                </div>
              </div>
              
              <div style="background: #f5f5f5; padding: 30px; border-left: 8px solid #ff0066;">
                <h3 style="margin: 0 0 15px 0; color: #000000; font-size: 18px; font-weight: 700; text-transform: uppercase;">DELIVERY ZONE</h3>
                <p style="margin: 0; color: #333333; font-size: 16px; font-weight: 500;">{{deliveryAddress}}</p>
              </div>
              
              <div style="text-align: center; margin: 40px 0 0 0; padding: 30px; background: linear-gradient(45deg, #ff0066, #ff3366); color: white; transform: skew(-1deg);">
                <div style="transform: skew(1deg);">
                  <p style="margin: 0; font-size: 18px; font-weight: 700; text-transform: uppercase;">
                    🚀 PREPARING YOUR ORDER NOW!
                  </p>
                  <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">TRACKING DETAILS COMING SOON</p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Bold Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #000000; color: white; text-align: center;">
              <p style="margin: 0; font-size: 16px; font-weight: 600; text-transform: uppercase;">
                NEED BACKUP? <a href="mailto:{{supportEmail}}" style="color: #ff0066; text-decoration: none; font-weight: 700;">{{supportEmail}}</a>
              </p>
              <p style="margin: 16px 0 0 0; color: #666666; font-size: 12px; text-transform: uppercase;">© {{companyName}} - ALWAYS DELIVERING</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `🔥 ORDER CONFIRMED #{{orderNumber}} - GET READY!

{{customerName}} - YOU'RE ALL SET!

💥 ORDER DETAILS:
━━━━━━━━━━━━━━━
Order: #{{orderNumber}}
Date: {{orderDate}}
Total: ${{orderTotal}}
Delivery: {{deliveryAddress}}
━━━━━━━━━━━━━━━

🚀 PREPARING YOUR ORDER NOW!
TRACKING DETAILS COMING SOON

NEED BACKUP? {{supportEmail}}

{{companyName}} - ALWAYS DELIVERING`
  },

  {
    template_key: 'order_confirmation_elegant',
    template_name: 'Order Confirmation - Elegant Style',
    subject_template: 'Your Exquisite Order #{{orderNumber}} - Confirmed with Gratitude',
    category: 'order_confirmation',
    style: 'elegant',
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'orderTotal', 'orderDate', 'deliveryAddress', 'companyName', 'supportEmail'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Georgia, 'Times New Roman', serif; background-color: #fafafa; line-height: 1.8;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e8e8e8;">
          <!-- Elegant Header -->
          <tr>
            <td style="padding: 60px 50px 40px 50px; text-align: center; border-bottom: 3px double #d4af37;">
              <div style="width: 120px; height: 1px; background: linear-gradient(to right, transparent, #d4af37, transparent); margin: 0 auto 30px auto;"></div>
              <h1 style="margin: 0; color: #2c2c2c; font-size: 32px; font-weight: 300; letter-spacing: 3px; text-transform: uppercase;">Order Confirmed</h1>
              <div style="width: 60px; height: 1px; background: #d4af37; margin: 20px auto; opacity: 0.7;"></div>
              <p style="margin: 0; color: #666666; font-size: 18px; font-style: italic;">Dear {{customerName}}, thank you for choosing excellence</p>
            </td>
          </tr>
          
          <!-- Elegant Content -->
          <tr>
            <td style="padding: 50px;">
              <p style="margin: 0 0 30px 0; color: #444444; font-size: 16px; line-height: 1.8;">
                We are delighted to confirm that your order has been received and is being prepared with the utmost care and attention to detail.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 40px 0;">
                <tr>
                  <td style="padding: 30px; background: #fbfbfb; border: 1px solid #e8e8e8; border-left: 4px solid #d4af37;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td colspan="2" style="padding-bottom: 20px; border-bottom: 1px solid #e8e8e8;">
                          <h2 style="margin: 0; color: #2c2c2c; font-size: 20px; font-weight: 400; letter-spacing: 1px;">Order Details</h2>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 15px 0; color: #666666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Order Number</td>
                        <td style="padding: 15px 0; color: #2c2c2c; font-size: 16px; text-align: right; font-weight: 500;">#{{orderNumber}}</td>
                      </tr>
                      <tr>
                        <td style="padding: 15px 0; color: #666666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Order Date</td>
                        <td style="padding: 15px 0; color: #2c2c2c; font-size: 16px; text-align: right;">{{orderDate}}</td>
                      </tr>
                      <tr>
                        <td style="padding: 15px 0; color: #666666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Investment</td>
                        <td style="padding: 15px 0; color: #d4af37; font-size: 20px; text-align: right; font-weight: 600;">${{orderTotal}}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 20px 0 15px 0; border-top: 1px solid #e8e8e8;">
                          <div style="color: #666666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Delivery Address</div>
                          <div style="color: #2c2c2c; font-size: 16px; line-height: 1.6;">{{deliveryAddress}}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 40px 0 0 0; color: #666666; font-size: 15px; line-height: 1.8; font-style: italic; text-align: center;">
                "Excellence is never an accident. It is always the result of high intention, sincere effort, and intelligent execution."
              </p>
            </td>
          </tr>
          
          <!-- Elegant Footer -->
          <tr>
            <td style="padding: 40px 50px 60px 50px; border-top: 3px double #d4af37; text-align: center;">
              <div style="width: 120px; height: 1px; background: linear-gradient(to right, transparent, #d4af37, transparent); margin: 0 auto 30px auto;"></div>
              <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Should you require any assistance, our dedicated team is at your service.<br>
                <a href="mailto:{{supportEmail}}" style="color: #d4af37; text-decoration: none; font-weight: 500;">{{supportEmail}}</a>
              </p>
              <p style="margin: 30px 0 0 0; color: #999999; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">
                With sincere regards, {{companyName}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `Order Confirmed - #{{orderNumber}}

Dear {{customerName}},

Thank you for choosing excellence. We are delighted to confirm that your order has been received and is being prepared with the utmost care.

ORDER DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Order Number: #{{orderNumber}}
Order Date: {{orderDate}}
Total Investment: ${{orderTotal}}
Delivery Address: {{deliveryAddress}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Excellence is never an accident. It is always the result of high intention, sincere effort, and intelligent execution."

Should you require any assistance, our dedicated team is at your service at {{supportEmail}}.

With sincere regards,
{{companyName}}`
  },

  // SHIPPING UPDATE TEMPLATES (3 templates)
  {
    template_key: 'order_shipped_tracking',
    template_name: 'Order Shipped with Tracking',
    subject_template: '📦 Your Order #{{orderNumber}} Has Shipped!',
    category: 'shipping',
    style: 'modern',
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'trackingNumber', 'trackingUrl', 'estimatedDelivery', 'companyName', 'supportEmail'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Shipped</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); text-align: center; color: white;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px auto; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px;">📦</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Your Order Has Shipped!</h1>
              <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.9;">Hi {{customerName}}, your package is on its way to you!</p>
            </td>
          </tr>
          
          <!-- Tracking Info -->
          <tr>
            <td style="padding: 40px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center; color: white;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Tracking Information</h2>
                <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">Tracking Number</div>
                  <div style="font-size: 24px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">{{trackingNumber}}</div>
                </div>
                <a href="{{trackingUrl}}" style="display: inline-block; background: white; color: #667eea; padding: 14px 28px; border-radius: 25px; text-decoration: none; font-weight: 600; margin-top: 15px;">Track Your Package</a>
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8fafc; padding: 20px; border-radius: 8px;">
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Order Number:</td>
                  <td style="padding: 10px 0; color: #1e293b; font-weight: 600; text-align: right;">#{{orderNumber}}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Estimated Delivery:</td>
                  <td style="padding: 10px 0; color: #059669; font-weight: 600; text-align: right;">{{estimatedDelivery}}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #f8fafc; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Questions about your shipment? Contact us at <a href="mailto:{{supportEmail}}" style="color: #4facfe; text-decoration: none; font-weight: 500;">{{supportEmail}}</a>
              </p>
              <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">© {{companyName}}. Delivered with care.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `📦 Your Order #{{orderNumber}} Has Shipped!

Hi {{customerName}},

Great news! Your package is on its way to you.

🚚 TRACKING DETAILS:
Tracking Number: {{trackingNumber}}
Track your package: {{trackingUrl}}
Estimated Delivery: {{estimatedDelivery}}

Questions? Contact us at {{supportEmail}}

{{companyName}} - Delivered with care.`
  },

  {
    template_key: 'out_for_delivery',
    template_name: 'Out for Delivery Alert',
    subject_template: '🚚 Your Order #{{orderNumber}} is Out for Delivery!',
    category: 'shipping',
    style: 'clean',
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'deliveryTimeWindow', 'driverName', 'driverPhone', 'companyName'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Out for Delivery</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border-radius: 8px 8px 0 0;">
              <div style="font-size: 48px; margin-bottom: 15px;">🚚</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Out for Delivery!</h1>
              <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.9;">Hi {{customerName}}, your order is almost there!</p>
            </td>
          </tr>
          
          <!-- Delivery Info -->
          <tr>
            <td style="padding: 40px;">
              <div style="background: #ecfdf5; border: 2px solid #10b981; padding: 25px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
                <h2 style="margin: 0 0 15px 0; color: #059669; font-size: 20px; font-weight: 600;">Delivery Window</h2>
                <p style="margin: 0; color: #065f46; font-size: 18px; font-weight: 600;">{{deliveryTimeWindow}}</p>
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 25px 0;">
                <tr>
                  <td style="padding: 15px; background: #f1f5f9; border-radius: 6px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Order Number:</td>
                        <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">#{{orderNumber}}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Driver:</td>
                        <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">{{driverName}}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Driver Contact:</td>
                        <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">{{driverPhone}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">
                  💡 <strong>Delivery Tip:</strong> Please ensure someone is available to receive your package during the delivery window.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Thank you for choosing {{companyName}}!
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `🚚 Your Order #{{orderNumber}} is Out for Delivery!

Hi {{customerName}},

Your order is almost there!

🕐 DELIVERY WINDOW: {{deliveryTimeWindow}}

📦 Order: #{{orderNumber}}
👤 Driver: {{driverName}}
📞 Driver Contact: {{driverPhone}}

💡 Please ensure someone is available to receive your package.

Thank you,
{{companyName}}`
  },

  {
    template_key: 'package_delivered',
    template_name: 'Package Delivered Confirmation',
    subject_template: '✅ Your Order #{{orderNumber}} Has Been Delivered!',
    category: 'shipping',
    style: 'clean',
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'deliveryTime', 'companyName', 'supportEmail', 'reviewUrl'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Package Delivered</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Success Header -->
          <tr>
            <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border-radius: 8px 8px 0 0;">
              <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
              <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Delivered Successfully!</h1>
              <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Your order has arrived, {{customerName}}!</p>
            </td>
          </tr>
          
          <!-- Delivery Confirmation -->
          <tr>
            <td style="padding: 40px;">
              <div style="background: #ecfdf5; border: 2px solid #10b981; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; color: #059669; font-size: 22px; font-weight: 600;">Order #{{orderNumber}}</h2>
                <p style="margin: 0; color: #065f46; font-size: 16px;">Delivered on {{deliveryTime}}</p>
              </div>
              
              <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; text-align: center;">
                We hope you love your order! Your satisfaction is our top priority.
              </p>
              
              <!-- Review CTA -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{reviewUrl}}" style="display: inline-block; background: #3b82f6; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Share Your Experience
                </a>
                <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 14px;">
                  Your feedback helps us serve you better
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Questions about your order? Contact us at <a href="mailto:{{supportEmail}}" style="color: #3b82f6; text-decoration: none;">{{supportEmail}}</a>
              </p>
              <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">© {{companyName}}. Thank you for your business!</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `✅ Your Order #{{orderNumber}} Has Been Delivered!

Hi {{customerName}},

Great news! Your order has arrived successfully.

📦 Order: #{{orderNumber}}
🕐 Delivered: {{deliveryTime}}

We hope you love your order! Your satisfaction is our top priority.

Share your experience: {{reviewUrl}}

Questions? Contact us at {{supportEmail}}

Thank you,
{{companyName}}`
  },

  // ABANDONED CART TEMPLATES (3 templates)
  {
    template_key: 'abandoned_cart_reminder_1hr',
    template_name: 'Abandoned Cart - 1 Hour Reminder',
    subject_template: '🛒 You left something in your cart, {{customerName}}',
    category: 'abandoned_cart',
    style: 'modern',
    template_type: 'marketing',
    variables: ['customerName', 'cartTotal', 'cartUrl', 'productNames', 'companyName'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Don't Forget Your Cart</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%); text-align: center; color: white;">
              <div style="font-size: 48px; margin-bottom: 15px;">🛒</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Don't Forget Your Cart!</h1>
              <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.9;">Hi {{customerName}}, you have some great items waiting!</p>
            </td>
          </tr>
          
          <!-- Cart Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="background: #fef7ff; border: 2px solid #d946ef; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
                <h2 style="margin: 0 0 15px 0; color: #a21caf; font-size: 20px; font-weight: 600;">Your Cart Summary</h2>
                <p style="margin: 0 0 10px 0; color: #701a75; font-size: 16px;">{{productNames}}</p>
                <div style="border-top: 1px solid #e879f9; padding-top: 15px; margin-top: 15px;">
                  <span style="color: #86198f; font-size: 14px;">Total: </span>
                  <span style="color: #a21caf; font-size: 20px; font-weight: 700;">${{cartTotal}}</span>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{cartUrl}}" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #d946ef 100%); color: white; padding: 16px 32px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);">
                  Complete Your Order
                </a>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; text-align: center;">
                ⏰ <strong>Hurry!</strong> Items in your cart are popular and may sell out soon.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #f8fafc; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Need help with your order? We're here to assist you!
              </p>
              <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">© {{companyName}}. Making shopping delightful.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `🛒 You left something in your cart, {{customerName}}

Hi {{customerName}},

You have some great items waiting in your cart!

CART SUMMARY:
{{productNames}}
Total: ${{cartTotal}}

⏰ Hurry! Items may sell out soon.

Complete your order: {{cartUrl}}

{{companyName}} - Making shopping delightful.`
  },

  {
    template_key: 'abandoned_cart_discount_24hr',
    template_name: 'Abandoned Cart - 24 Hour Discount',
    subject_template: '💸 20% OFF Your Cart - Limited Time!',
    category: 'abandoned_cart',
    style: 'bold',
    template_type: 'marketing',
    variables: ['customerName', 'cartTotal', 'discountCode', 'cartUrl', 'productNames', 'companyName', 'discountAmount'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exclusive Discount</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 0; box-shadow: 0 0 40px rgba(255,215,0,0.3);">
          <!-- Discount Header -->
          <tr>
            <td style="padding: 0; background: linear-gradient(45deg, #ffd700, #ffed4e); text-align: center; color: #000000; position: relative;">
              <div style="padding: 40px; transform: skew(-2deg); margin: -10px 0;">
                <div style="transform: skew(2deg);">
                  <h1 style="margin: 0; font-size: 36px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px;">20% OFF!</h1>
                  <div style="width: 100px; height: 4px; background: #000000; margin: 20px auto; border-radius: 2px;"></div>
                  <p style="margin: 0; font-size: 18px; font-weight: 700; text-transform: uppercase;">EXCLUSIVE DISCOUNT FOR {{customerName}}</p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Discount Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="border: 4px solid #ffd700; padding: 30px; margin-bottom: 30px; background: #000000; color: white; text-align: center;">
                <h2 style="margin: 0 0 20px 0; color: #ffd700; font-size: 24px; font-weight: 800; text-transform: uppercase;">YOUR CART IS WAITING</h2>
                <div style="background: #ffd700; color: #000000; padding: 20px; margin: 20px 0; transform: skew(-1deg);">
                  <div style="transform: skew(1deg);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 10px;">{{productNames}}</div>
                    <div style="font-size: 28px; font-weight: 900;">WAS ${{cartTotal}} → NOW ${{discountAmount}}</div>
                  </div>
                </div>
                <div style="background: #ff0000; color: white; padding: 15px; margin: 20px 0; text-align: center;">
                  <div style="font-size: 20px; font-weight: 800; letter-spacing: 2px;">CODE: {{discountCode}}</div>
                </div>
              </div>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="{{cartUrl}}" style="display: inline-block; background: linear-gradient(45deg, #ffd700, #ffed4e); color: #000000; padding: 20px 40px; text-decoration: none; font-weight: 800; font-size: 18px; text-transform: uppercase; letter-spacing: 2px; border-radius: 0; box-shadow: 0 4px 20px rgba(255,215,0,0.4);">
                  CLAIM 20% OFF NOW
                </a>
              </div>
              
              <div style="background: #ff0000; color: white; padding: 20px; text-align: center; transform: skew(-1deg); margin: 30px 0;">
                <div style="transform: skew(1deg);">
                  <p style="margin: 0; font-size: 16px; font-weight: 700; text-transform: uppercase;">
                    ⚠️ LIMITED TIME: EXPIRES IN 24 HOURS!
                  </p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #000000; color: white; text-align: center;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; text-transform: uppercase;">
                DON'T MISS OUT - {{companyName}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `💸 20% OFF Your Cart - LIMITED TIME!

{{customerName}} - EXCLUSIVE DISCOUNT!

🛒 YOUR CART:
{{productNames}}
WAS: ${{cartTotal}}
NOW: ${{discountAmount}}

🎫 DISCOUNT CODE: {{discountCode}}

⚠️ LIMITED TIME: EXPIRES IN 24 HOURS!

CLAIM YOUR DISCOUNT: {{cartUrl}}

{{companyName}} - DON'T MISS OUT!`
  },

  {
    template_key: 'abandoned_cart_final_72hr',
    template_name: 'Abandoned Cart - Final Attempt (72 hours)',
    subject_template: '😢 We miss you, {{customerName}} - Last chance!',
    category: 'abandoned_cart',
    style: 'elegant',
    template_type: 'marketing',
    variables: ['customerName', 'cartTotal', 'cartUrl', 'productNames', 'companyName', 'unsubscribeUrl'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We Miss You</title>
</head>
<body style="margin: 0; padding: 0; font-family: Georgia, 'Times New Roman', serif; background-color: #fafafa; line-height: 1.8;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e8e8e8;">
          <!-- Elegant Header -->
          <tr>
            <td style="padding: 60px 50px 40px 50px; text-align: center; border-bottom: 3px double #b91c1c;">
              <div style="width: 120px; height: 1px; background: linear-gradient(to right, transparent, #b91c1c, transparent); margin: 0 auto 30px auto;"></div>
              <h1 style="margin: 0; color: #7f1d1d; font-size: 28px; font-weight: 300; letter-spacing: 2px;">We Miss You</h1>
              <div style="width: 60px; height: 1px; background: #b91c1c; margin: 20px auto; opacity: 0.7;"></div>
              <p style="margin: 0; color: #666666; font-size: 16px; font-style: italic;">Dear {{customerName}}, this is our final invitation</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 50px;">
              <p style="margin: 0 0 30px 0; color: #444444; font-size: 16px; line-height: 1.8;">
                We noticed that you left some wonderful items in your cart, and we wanted to reach out one last time. 
                Your thoughtful selections are still waiting for you, and we'd hate for you to miss out.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 40px 0;">
                <tr>
                  <td style="padding: 30px; background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #b91c1c;">
                    <h2 style="margin: 0 0 20px 0; color: #7f1d1d; font-size: 18px; font-weight: 400; letter-spacing: 1px;">Your Reserved Items</h2>
                    <p style="margin: 0 0 15px 0; color: #991b1b; font-size: 16px; line-height: 1.6;">{{productNames}}</p>
                    <div style="border-top: 1px solid #fca5a5; padding-top: 15px; margin-top: 15px;">
                      <span style="color: #7f1d1d; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Value: </span>
                      <span style="color: #991b1b; font-size: 18px; font-weight: 600;">${{cartTotal}}</span>
                    </div>
                  </td>
                </tr>
              </table>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="{{cartUrl}}" style="display: inline-block; background: #7f1d1d; color: white; padding: 16px 32px; text-decoration: none; font-weight: 500; font-size: 16px; letter-spacing: 1px; border: none;">
                  Complete Your Purchase
                </a>
              </div>
              
              <p style="margin: 40px 0 0 0; color: #666666; font-size: 14px; line-height: 1.8; font-style: italic; text-align: center;">
                "Quality is never an accident; it is always the result of intelligent effort." - John Ruskin
              </p>
              
              <div style="text-align: center; margin: 40px 0 0 0; padding: 20px 0; border-top: 1px solid #e8e8e8;">
                <p style="margin: 0 0 15px 0; color: #999999; font-size: 12px;">
                  If you no longer wish to receive these reminders, you may 
                  <a href="{{unsubscribeUrl}}" style="color: #b91c1c; text-decoration: none;">unsubscribe here</a>.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 40px 50px 60px 50px; border-top: 3px double #b91c1c; text-align: center;">
              <div style="width: 120px; height: 1px; background: linear-gradient(to right, transparent, #b91c1c, transparent); margin: 0 auto 30px auto;"></div>
              <p style="margin: 0; color: #999999; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">
                With heartfelt regards, {{companyName}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `We Miss You - Final Invitation

Dear {{customerName}},

We noticed that you left some wonderful items in your cart, and we wanted to reach out one last time. Your thoughtful selections are still waiting for you.

YOUR RESERVED ITEMS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{productNames}}
Total Value: ${{cartTotal}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Complete your purchase: {{cartUrl}}

"Quality is never an accident; it is always the result of intelligent effort." - John Ruskin

If you no longer wish to receive these reminders, you may unsubscribe here: {{unsubscribeUrl}}

With heartfelt regards,
{{companyName}}`
  },

  // WELCOME SERIES TEMPLATES (3 templates)
  {
    template_key: 'welcome_new_customer',
    template_name: 'Welcome New Customer',
    subject_template: '🎉 Welcome to {{companyName}}, {{customerName}}!',
    category: 'welcome',
    style: 'modern',
    template_type: 'transactional',
    variables: ['customerName', 'companyName', 'loginUrl', 'supportEmail', 'discountCode'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">
          <!-- Welcome Header -->
          <tr>
            <td style="padding: 50px 40px 40px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center; color: white;">
              <div style="font-size: 64px; margin-bottom: 20px;">🎉</div>
              <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Welcome to {{companyName}}!</h1>
              <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Hi {{customerName}}, we're thrilled to have you join our community!</p>
            </td>
          </tr>
          
          <!-- Welcome Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center; color: white;">
                <h2 style="margin: 0 0 15px 0; font-size: 22px; font-weight: 600;">Your Welcome Gift 🎁</h2>
                <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; margin: 15px 0;">
                  <div style="font-size: 16px; margin-bottom: 8px;">Use code:</div>
                  <div style="font-size: 28px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 3px;">{{discountCode}}</div>
                  <div style="font-size: 14px; margin-top: 8px; opacity: 0.9;">Get 15% off your first order!</div>
                </div>
              </div>
              
              <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600; text-align: center;">What You Can Do Now:</h3>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
                <div style="background: #f8fafc; padding: 25px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 32px; margin-bottom: 10px;">🛍️</div>
                  <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Start Shopping</h4>
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Browse our amazing collection</p>
                </div>
                <div style="background: #f8fafc; padding: 25px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 32px; margin-bottom: 10px;">❤️</div>
                  <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Save Favorites</h4>
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Create your wishlist</p>
                </div>
                <div style="background: #f8fafc; padding: 25px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 32px; margin-bottom: 10px;">📱</div>
                  <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Track Orders</h4>
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Monitor your purchases</p>
                </div>
                <div style="background: #f8fafc; padding: 25px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 32px; margin-bottom: 10px;">🎁</div>
                  <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Exclusive Offers</h4>
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Access member-only deals</p>
                </div>
              </div>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Start Exploring
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #f8fafc; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Need help getting started? Contact us at <a href="mailto:{{supportEmail}}" style="color: #667eea; text-decoration: none; font-weight: 500;">{{supportEmail}}</a>
              </p>
              <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">© {{companyName}}. Welcome to the family! ❤️</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `🎉 Welcome to {{companyName}}, {{customerName}}!

Hi {{customerName}},

We're thrilled to have you join our community!

🎁 YOUR WELCOME GIFT:
Use code: {{discountCode}}
Get 15% off your first order!

WHAT YOU CAN DO NOW:
🛍️ Start Shopping - Browse our collection
❤️ Save Favorites - Create your wishlist  
📱 Track Orders - Monitor your purchases
🎁 Exclusive Offers - Access member deals

Start exploring: {{loginUrl}}

Need help? Contact us at {{supportEmail}}

Welcome to the family!
{{companyName}} ❤️`
  },

  {
    template_key: 'getting_started_guide',
    template_name: 'Getting Started Guide',
    subject_template: '📚 Your Getting Started Guide - {{companyName}}',
    category: 'welcome',
    style: 'clean',
    template_type: 'transactional',
    variables: ['customerName', 'companyName', 'helpUrl', 'accountUrl', 'catalogUrl', 'supportEmail'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Getting Started Guide</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <div style="font-size: 48px; margin-bottom: 15px;">📚</div>
              <h1 style="margin: 0; color: #1e293b; font-size: 28px; font-weight: 600;">Getting Started Guide</h1>
              <p style="margin: 12px 0 0 0; color: #64748b; font-size: 16px;">Everything you need to know, {{customerName}}</p>
            </td>
          </tr>
          
          <!-- Guide Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px;">
                Welcome to {{companyName}}! We've put together this quick guide to help you make the most of your experience with us.
              </p>
              
              <!-- Step by Step Guide -->
              <div style="margin: 30px 0;">
                <!-- Step 1 -->
                <div style="display: flex; margin-bottom: 25px;">
                  <div style="background: #3b82f6; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 20px; flex-shrink: 0;">1</div>
                  <div style="flex: 1;">
                    <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Complete Your Profile</h3>
                    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Add your delivery address and payment preferences for faster checkout.</p>
                    <a href="{{accountUrl}}" style="color: #3b82f6; text-decoration: none; font-weight: 500; font-size: 14px;">Go to Account Settings →</a>
                  </div>
                </div>
                
                <!-- Step 2 -->
                <div style="display: flex; margin-bottom: 25px;">
                  <div style="background: #10b981; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 20px; flex-shrink: 0;">2</div>
                  <div style="flex: 1;">
                    <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Browse Our Collection</h3>
                    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Discover our carefully curated selection of products just for you.</p>
                    <a href="{{catalogUrl}}" style="color: #10b981; text-decoration: none; font-weight: 500; font-size: 14px;">Start Shopping →</a>
                  </div>
                </div>
                
                <!-- Step 3 -->
                <div style="display: flex; margin-bottom: 25px;">
                  <div style="background: #f59e0b; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 20px; flex-shrink: 0;">3</div>
                  <div style="flex: 1;">
                    <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Save Your Favorites</h3>
                    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Use the heart icon to save items you love for easy access later.</p>
                  </div>
                </div>
                
                <!-- Step 4 -->
                <div style="display: flex; margin-bottom: 0;">
                  <div style="background: #8b5cf6; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 20px; flex-shrink: 0;">4</div>
                  <div style="flex: 1;">
                    <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Track Your Orders</h3>
                    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Get real-time updates on your orders from confirmation to delivery.</p>
                  </div>
                </div>
              </div>
              
              <!-- Help Section -->
              <div style="background: #f1f5f9; padding: 25px; border-radius: 8px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Need Help?</h3>
                <p style="margin: 0 0 15px 0; color: #64748b; font-size: 14px;">We're here to help you every step of the way. Check out our help center or contact our support team.</p>
                <div style="display: flex; gap: 15px;">
                  <a href="{{helpUrl}}" style="color: #3b82f6; text-decoration: none; font-weight: 500; font-size: 14px;">Help Center →</a>
                  <a href="mailto:{{supportEmail}}" style="color: #3b82f6; text-decoration: none; font-weight: 500; font-size: 14px;">Contact Support →</a>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Have questions? We're always happy to help at <a href="mailto:{{supportEmail}}" style="color: #3b82f6; text-decoration: none;">{{supportEmail}}</a>
              </p>
              <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">© {{companyName}}. Your journey starts here.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `📚 Your Getting Started Guide

Hi {{customerName}},

Welcome to {{companyName}}! Here's everything you need to know:

GETTING STARTED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Complete Your Profile
   Add delivery address and payment preferences
   → {{accountUrl}}

2. Browse Our Collection  
   Discover our curated selection
   → {{catalogUrl}}

3. Save Your Favorites
   Use the heart icon to save items

4. Track Your Orders
   Get real-time delivery updates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEED HELP?
Help Center: {{helpUrl}}
Contact Support: {{supportEmail}}

Your journey starts here!
{{companyName}}`
  },

  {
    template_key: 'first_purchase_incentive',
    template_name: 'First Purchase Incentive',
    subject_template: '🎯 Ready for Your First Order? Here's 20% OFF!',
    category: 'welcome',
    style: 'bold',
    template_type: 'marketing',
    variables: ['customerName', 'discountCode', 'expiryDate', 'shopUrl', 'companyName', 'minOrderAmount'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>First Purchase Incentive</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 0; box-shadow: 0 0 40px rgba(34,197,94,0.3);">
          <!-- Bold Header -->
          <tr>
            <td style="padding: 0; background: linear-gradient(45deg, #22c55e, #16a34a); text-align: center; color: white; position: relative;">
              <div style="padding: 50px 40px; transform: skew(-2deg); margin: -10px 0;">
                <div style="transform: skew(2deg);">
                  <h1 style="margin: 0; font-size: 36px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">FIRST ORDER</h1>
                  <div style="width: 100px; height: 4px; background: white; margin: 20px auto; border-radius: 2px;"></div>
                  <p style="margin: 0; font-size: 20px; font-weight: 700; text-transform: uppercase;">{{customerName}} - TIME TO SHOP!</p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Incentive Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="border: 4px solid #22c55e; padding: 30px; margin-bottom: 30px; background: #000000; color: white; text-align: center;">
                <h2 style="margin: 0 0 20px 0; color: #22c55e; font-size: 28px; font-weight: 800; text-transform: uppercase;">20% OFF FIRST ORDER!</h2>
                <div style="background: #22c55e; color: #000000; padding: 25px; margin: 20px 0; transform: skew(-1deg);">
                  <div style="transform: skew(1deg);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 10px;">YOUR EXCLUSIVE CODE:</div>
                    <div style="font-size: 36px; font-weight: 900; letter-spacing: 4px;">{{discountCode}}</div>
                  </div>
                </div>
                <div style="background: #dc2626; color: white; padding: 15px; margin: 20px 0; text-align: center;">
                  <div style="font-size: 18px; font-weight: 700;">MINIMUM ORDER: ${{minOrderAmount}}</div>
                </div>
              </div>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="{{shopUrl}}" style="display: inline-block; background: linear-gradient(45deg, #22c55e, #16a34a); color: white; padding: 20px 40px; text-decoration: none; font-weight: 800; font-size: 20px; text-transform: uppercase; letter-spacing: 2px; border-radius: 0; box-shadow: 0 4px 20px rgba(34,197,94,0.4);">
                  CLAIM YOUR 20% OFF
                </a>
              </div>
              
              <div style="background: #fef3c7; border: 4px solid #f59e0b; padding: 25px; text-align: center; margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 20px; font-weight: 800; text-transform: uppercase;">⚡ LIMITED TIME OFFER!</h3>
                <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">
                  Code expires: {{expiryDate}}
                </p>
              </div>
              
              <div style="background: #000000; color: white; padding: 30px; text-align: center; transform: skew(-1deg); margin: 30px 0;">
                <div style="transform: skew(1deg);">
                  <p style="margin: 0; font-size: 18px; font-weight: 700; text-transform: uppercase;">
                    🚀 WHAT ARE YOU WAITING FOR?
                  </p>
                  <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">YOUR PERFECT PRODUCTS ARE WAITING!</p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #000000; color: white; text-align: center;">
              <p style="margin: 0; font-size: 16px; font-weight: 600; text-transform: uppercase;">
                GO BIG OR GO HOME - {{companyName}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `🎯 FIRST ORDER - 20% OFF!

{{customerName}} - TIME TO SHOP!

💥 YOUR EXCLUSIVE CODE: {{discountCode}}

🎯 20% OFF FIRST ORDER!
💰 MINIMUM ORDER: ${{minOrderAmount}}
⚡ EXPIRES: {{expiryDate}}

🚀 WHAT ARE YOU WAITING FOR?
YOUR PERFECT PRODUCTS ARE WAITING!

CLAIM YOUR 20% OFF: {{shopUrl}}

GO BIG OR GO HOME - {{companyName}}`
  },

  // PROMOTIONAL TEMPLATES (3 templates)
  {
    template_key: 'product_launch_announcement',
    template_name: 'Product Launch Announcement',
    subject_template: '🚀 NEW ARRIVAL: {{productName}} is Here!',
    category: 'promotional',
    style: 'modern',
    template_type: 'marketing',
    variables: ['customerName', 'productName', 'productDescription', 'originalPrice', 'launchPrice', 'productUrl', 'productImageUrl', 'companyName', 'unsubscribeUrl'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Product Launch</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.2);">
          <!-- Launch Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center; color: white;">
              <div style="font-size: 56px; margin-bottom: 15px;">🚀</div>
              <h1 style="margin: 0; font-size: 32px; font-weight: 700;">NEW ARRIVAL!</h1>
              <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">{{customerName}}, discover our latest addition</p>
            </td>
          </tr>
          
          <!-- Product Showcase -->
          <tr>
            <td style="padding: 0;">
              <img src="{{productImageUrl}}" alt="{{productName}}" style="width: 100%; height: 300px; object-fit: cover; display: block;">
            </td>
          </tr>
          
          <!-- Product Details -->
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 28px; font-weight: 700;">{{productName}}</h2>
                <p style="margin: 0; color: #64748b; font-size: 16px; line-height: 1.7;">{{productDescription}}</p>
              </div>
              
              <!-- Launch Pricing -->
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center; color: white;">
                <h3 style="margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">Launch Special!</h3>
                <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin: 15px 0;">
                  <span style="text-decoration: line-through; font-size: 20px; opacity: 0.7;">${{originalPrice}}</span>
                  <span style="font-size: 32px; font-weight: 700;">${{launchPrice}}</span>
                </div>
                <p style="margin: 15px 0 0 0; font-size: 14px; opacity: 0.9;">Limited time launch pricing</p>
              </div>
              
              <!-- Key Features -->
              <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 30px 0;">
                <h4 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px; font-weight: 600; text-align: center;">Why You'll Love It:</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <div style="text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 8px;">✨</div>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Premium Quality</p>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 8px;">🎯</div>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Perfect Design</p>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 8px;">⚡</div>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Fast Delivery</p>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 8px;">💝</div>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Gift Ready</p>
                  </div>
                </div>
              </div>
              
              <!-- CTA -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="{{productUrl}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 36px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 18px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                  Get Yours Now
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #f8fafc; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Thanks for being part of our community, {{customerName}}!
              </p>
              <p style="margin: 16px 0 8px 0; color: #94a3b8; font-size: 12px;">© {{companyName}}. Bringing you the best.</p>
              <a href="{{unsubscribeUrl}}" style="color: #94a3b8; font-size: 11px; text-decoration: none;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `🚀 NEW ARRIVAL: {{productName}} is Here!

Hi {{customerName}},

Discover our latest addition!

{{productName}}
{{productDescription}}

LAUNCH SPECIAL:
Was: ${{originalPrice}}
Now: ${{launchPrice}}

WHY YOU'LL LOVE IT:
✨ Premium Quality
🎯 Perfect Design
⚡ Fast Delivery
💝 Gift Ready

Get yours now: {{productUrl}}

Thanks for being part of our community!
{{companyName}}

Unsubscribe: {{unsubscribeUrl}}`
  },

  {
    template_key: 'seasonal_sale_campaign',
    template_name: 'Seasonal Sale Campaign',
    subject_template: '🔥 MEGA SALE: Up to {{maxDiscount}}% OFF Everything!',
    category: 'promotional',
    style: 'bold',
    template_type: 'marketing',
    variables: ['customerName', 'maxDiscount', 'saleEndDate', 'shopUrl', 'companyName', 'unsubscribeUrl', 'freeShippingThreshold'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mega Sale</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 0; box-shadow: 0 0 40px rgba(255,69,0,0.4);">
          <!-- Bold Sale Header -->
          <tr>
            <td style="padding: 0; background: linear-gradient(45deg, #ff4500, #ff6347); text-align: center; color: white; position: relative;">
              <div style="padding: 60px 40px; transform: skew(-3deg); margin: -15px 0;">
                <div style="transform: skew(3deg);">
                  <h1 style="margin: 0; font-size: 48px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; text-shadow: 3px 3px 6px rgba(0,0,0,0.4);">MEGA SALE</h1>
                  <div style="width: 120px; height: 6px; background: white; margin: 25px auto; border-radius: 3px;"></div>
                  <p style="margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">UP TO {{maxDiscount}}% OFF EVERYTHING!</p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Sale Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="margin: 0 0 20px 0; color: #000000; font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">{{customerName}}!</h2>
                <p style="margin: 0; color: #333333; font-size: 18px; font-weight: 600;">THE BIGGEST SALE OF THE YEAR IS HERE!</p>
              </div>
              
              <!-- Sale Highlights -->
              <div style="background: #000000; color: white; padding: 40px; margin: 30px 0; text-align: center;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin: 20px 0;">
                  <div>
                    <div style="font-size: 48px; font-weight: 900; color: #ff4500; margin-bottom: 10px;">{{maxDiscount}}%</div>
                    <div style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">MAX DISCOUNT</div>
                  </div>
                  <div>
                    <div style="font-size: 48px; font-weight: 900; color: #ff4500; margin-bottom: 10px;">${{freeShippingThreshold}}</div>
                    <div style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">FREE SHIPPING</div>
                  </div>
                  <div>
                    <div style="font-size: 48px; font-weight: 900; color: #ff4500; margin-bottom: 10px;">24H</div>
                    <div style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">DELIVERY</div>
                  </div>
                </div>
              </div>
              
              <!-- Urgency Banner -->
              <div style="background: #dc2626; color: white; padding: 25px; text-align: center; transform: skew(-2deg); margin: 40px 0;">
                <div style="transform: skew(2deg);">
                  <h3 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">🚨 SALE ENDS: {{saleEndDate}} 🚨</h3>
                  <p style="margin: 0; font-size: 16px; font-weight: 600;">DON'T WAIT - STOCKS ARE FLYING OFF THE SHELVES!</p>
                </div>
              </div>
              
              <!-- Mega CTA -->
              <div style="text-align: center; margin: 50px 0;">
                <a href="{{shopUrl}}" style="display: inline-block; background: linear-gradient(45deg, #ff4500, #ff6347); color: white; padding: 25px 50px; text-decoration: none; font-weight: 900; font-size: 22px; text-transform: uppercase; letter-spacing: 3px; border-radius: 0; box-shadow: 0 6px 25px rgba(255,69,0,0.5); border: 4px solid #ffffff;">
                  SHOP THE SALE NOW!
                </a>
              </div>
              
              <!-- Sale Categories -->
              <div style="background: #f5f5f5; padding: 30px; margin: 40px 0;">
                <h4 style="margin: 0 0 20px 0; color: #000000; font-size: 20px; font-weight: 800; text-transform: uppercase; text-align: center;">EVERYTHING ON SALE:</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: center;">
                  <div style="background: #ff4500; color: white; padding: 15px; font-weight: 700; text-transform: uppercase;">ELECTRONICS</div>
                  <div style="background: #ff4500; color: white; padding: 15px; font-weight: 700; text-transform: uppercase;">FASHION</div>
                  <div style="background: #ff4500; color: white; padding: 15px; font-weight: 700; text-transform: uppercase;">HOME & GARDEN</div>
                  <div style="background: #ff4500; color: white; padding: 15px; font-weight: 700; text-transform: uppercase;">SPORTS</div>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #000000; color: white; text-align: center;">
              <p style="margin: 0; font-size: 16px; font-weight: 700; text-transform: uppercase;">
                SALE OF THE CENTURY - {{companyName}}
              </p>
              <p style="margin: 16px 0 8px 0; color: #666666; font-size: 12px; text-transform: uppercase;">LIMITED TIME ONLY</p>
              <a href="{{unsubscribeUrl}}" style="color: #666666; font-size: 11px; text-decoration: none;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `🔥 MEGA SALE: Up to {{maxDiscount}}% OFF Everything!

{{customerName}}!

THE BIGGEST SALE OF THE YEAR IS HERE!

🔥 UP TO {{maxDiscount}}% OFF EVERYTHING
🚚 FREE SHIPPING OVER ${{freeShippingThreshold}}
⚡ 24H DELIVERY AVAILABLE

🚨 SALE ENDS: {{saleEndDate}} 🚨
DON'T WAIT - STOCKS ARE FLYING!

EVERYTHING ON SALE:
• ELECTRONICS
• FASHION  
• HOME & GARDEN
• SPORTS

SHOP THE SALE NOW: {{shopUrl}}

SALE OF THE CENTURY - {{companyName}}

Unsubscribe: {{unsubscribeUrl}}`
  },

  {
    template_key: 'newsletter_update',
    template_name: 'Newsletter Update',
    subject_template: '📰 {{companyName}} Newsletter - {{monthYear}}',
    category: 'promotional',
    style: 'elegant',
    template_type: 'marketing',
    variables: ['customerName', 'monthYear', 'featuredProduct', 'featuredProductUrl', 'blogPostTitle', 'blogPostUrl', 'upcomingEvents', 'companyName', 'unsubscribeUrl', 'socialLinks'],
    html_template: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter</title>
</head>
<body style="margin: 0; padding: 0; font-family: Georgia, 'Times New Roman', serif; background-color: #fafafa; line-height: 1.8;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e8e8e8;">
          <!-- Newsletter Header -->
          <tr>
            <td style="padding: 60px 50px 40px 50px; text-align: center; border-bottom: 3px double #2563eb;">
              <div style="width: 120px; height: 1px; background: linear-gradient(to right, transparent, #2563eb, transparent); margin: 0 auto 30px auto;"></div>
              <h1 style="margin: 0; color: #1e40af; font-size: 32px; font-weight: 300; letter-spacing: 3px; text-transform: uppercase;">Newsletter</h1>
              <div style="width: 60px; height: 1px; background: #2563eb; margin: 20px auto; opacity: 0.7;"></div>
              <p style="margin: 0; color: #666666; font-size: 16px; font-style: italic;">{{monthYear}} Edition - Dear {{customerName}}</p>
            </td>
          </tr>
          
          <!-- Newsletter Content -->
          <tr>
            <td style="padding: 50px;">
              <p style="margin: 0 0 30px 0; color: #444444; font-size: 16px; line-height: 1.8; font-style: italic;">
                Greetings and welcome to our monthly newsletter. We are delighted to share our latest updates, featured products, and upcoming events with our valued community.
              </p>
              
              <!-- Featured Product Section -->
              <div style="margin: 40px 0;">
                <h2 style="margin: 0 0 25px 0; color: #1e40af; font-size: 22px; font-weight: 400; letter-spacing: 1px; text-align: center; border-bottom: 1px solid #e8e8e8; padding-bottom: 15px;">Featured This Month</h2>
                
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                  <tr>
                    <td style="padding: 30px; background: #fbfbfb; border: 1px solid #e8e8e8; border-left: 4px solid #2563eb;">
                      <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 20px; font-weight: 500;">{{featuredProduct}}</h3>
                      <p style="margin: 0 0 20px 0; color: #666666; font-size: 15px; line-height: 1.7;">
                        Discover our carefully selected featured product, chosen for its exceptional quality and timeless appeal. 
                        A perfect addition to your collection.
                      </p>
                      <a href="{{featuredProductUrl}}" style="color: #1e40af; text-decoration: none; font-weight: 500; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                        View Product →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Latest Blog Post -->
              <div style="margin: 40px 0;">
                <h2 style="margin: 0 0 25px 0; color: #1e40af; font-size: 22px; font-weight: 400; letter-spacing: 1px; text-align: center; border-bottom: 1px solid #e8e8e8; padding-bottom: 15px;">From Our Journal</h2>
                
                <div style="background: #f8fafc; padding: 25px; border-left: 3px solid #2563eb; margin: 25px 0;">
                  <h4 style="margin: 0 0 12px 0; color: #1e40af; font-size: 18px; font-weight: 500;">{{blogPostTitle}}</h4>
                  <p style="margin: 0 0 15px 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                    Our latest insights and stories, carefully crafted to inform and inspire our community.
                  </p>
                  <a href="{{blogPostUrl}}" style="color: #2563eb; text-decoration: none; font-weight: 500; font-size: 14px;">
                    Read Full Article →
                  </a>
                </div>
              </div>
              
              <!-- Upcoming Events -->
              <div style="margin: 40px 0;">
                <h2 style="margin: 0 0 25px 0; color: #1e40af; font-size: 22px; font-weight: 400; letter-spacing: 1px; text-align: center; border-bottom: 1px solid #e8e8e8; padding-bottom: 15px;">Upcoming Events</h2>
                
                <div style="background: #fef7ff; border: 1px solid #e879f9; padding: 25px; border-radius: 4px;">
                  <p style="margin: 0; color: #86198f; font-size: 15px; line-height: 1.7;">{{upcomingEvents}}</p>
                </div>
              </div>
              
              <!-- Elegant Quote -->
              <div style="text-align: center; margin: 50px 0; padding: 30px 0; border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8;">
                <p style="margin: 0; color: #666666; font-size: 16px; line-height: 1.8; font-style: italic;">
                  "Excellence is an art won by training and habituation." - Aristotle
                </p>
              </div>
              
              <!-- Social Links -->
              <div style="text-align: center; margin: 40px 0;">
                <h3 style="margin: 0 0 20px 0; color: #1e40af; font-size: 18px; font-weight: 400; letter-spacing: 1px;">Connect With Us</h3>
                <p style="margin: 0; color: #64748b; font-size: 14px;">{{socialLinks}}</p>
              </div>
            </td>
          </tr>
          
          <!-- Elegant Footer -->
          <tr>
            <td style="padding: 40px 50px 60px 50px; border-top: 3px double #2563eb; text-align: center;">
              <div style="width: 120px; height: 1px; background: linear-gradient(to right, transparent, #2563eb, transparent); margin: 0 auto 30px auto;"></div>
              <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Thank you for being a cherished member of our community. Should you wish to modify your subscription preferences, 
                you may do so <a href="{{unsubscribeUrl}}" style="color: #2563eb; text-decoration: none;">here</a>.
              </p>
              <p style="margin: 30px 0 0 0; color: #999999; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">
                With distinguished regards, {{companyName}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text_template: `📰 {{companyName}} Newsletter - {{monthYear}}

Dear {{customerName}},

Greetings and welcome to our monthly newsletter. We are delighted to share our latest updates with our valued community.

FEATURED THIS MONTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{featuredProduct}}

Discover our carefully selected featured product, chosen for its exceptional quality and timeless appeal.

View Product: {{featuredProductUrl}}

FROM OUR JOURNAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{blogPostTitle}}

Our latest insights and stories, carefully crafted to inform and inspire our community.

Read Full Article: {{blogPostUrl}}

UPCOMING EVENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{upcomingEvents}}

CONNECT WITH US
{{socialLinks}}

"Excellence is an art won by training and habituation." - Aristotle

Thank you for being a cherished member of our community.

Modify subscription: {{unsubscribeUrl}}

With distinguished regards,
{{companyName}}`
  }
];