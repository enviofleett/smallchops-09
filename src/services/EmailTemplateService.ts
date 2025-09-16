import { supabase } from '@/integrations/supabase/client';

export interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template: string;
  variables: string[];
  template_type: string;
  is_active: boolean;
}

export interface EmailVariables {
  customer_name?: string;
  customer_email?: string;
  order_number?: string;
  order_total?: string;
  payment_reference?: string;
  order_date?: string;
  store_name?: string;
  store_url?: string;
  support_email?: string;
  order_items?: string;
  delivery_address?: string;
  tracking_number?: string;
  [key: string]: string | undefined;
}

class EmailTemplateService {
  private templateCache = new Map<string, EmailTemplate>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getTemplate(templateKey: string): Promise<EmailTemplate | null> {
    try {
      // Check cache first
      const cached = this.templateCache.get(templateKey);
      const expiry = this.cacheExpiry.get(templateKey);
      
      if (cached && expiry && Date.now() < expiry) {
        return cached;
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.warn(`Email template not found: ${templateKey}`);
        return null;
      }

      // Cache the template
      this.templateCache.set(templateKey, data);
      this.cacheExpiry.set(templateKey, Date.now() + this.CACHE_TTL);

      return data;
    } catch (error) {
      console.error('Error fetching email template:', error);
      return null;
    }
  }

  async getAllTemplates(): Promise<EmailTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_key');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching email templates:', error);
      return [];
    }
  }

  processTemplate(template: EmailTemplate, variables: EmailVariables): {
    subject: string;
    html: string;
    text: string;
  } {
    const processText = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return variables[variable] || match;
      });
    };

    return {
      subject: processText(template.subject_template),
      html: processText(template.html_template),
      text: processText(template.text_template)
    };
  }

  async sendTemplatedEmail(
    templateKey: string,
    recipient: string,
    variables: EmailVariables,
    options: {
      priority?: 'high' | 'normal' | 'low';
      sendImmediate?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      console.log(`🎨 Sending templated email: ${templateKey} to ${recipient}`);

      // Send standardized payload to unified SMTP sender
      // Let the edge function handle template processing server-side
      const payload = {
        to: recipient,
        templateKey: templateKey,
        variables: variables || {},
        emailType: 'transactional',
        priority: options.priority || 'normal'
      };

      console.log('📤 Sending payload:', payload);

      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: payload
      });

      if (error) {
        console.error('❌ Supabase function error:', error);
        return false;
      }

      // Handle both success/error response formats
      if (data && !data.success && data.error) {
        console.error('❌ SMTP Error:', data.error);
        return false;
      }

      console.log(`✅ Templated email sent: ${templateKey} to ${recipient}`);
      return true;
    } catch (error) {
      console.error('💥 Error in sendTemplatedEmail:', error);
      return false;
    }
  }

  clearCache(): void {
    this.templateCache.clear();
    this.cacheExpiry.clear();
  }

  // Default fallback templates
  getDefaultTemplate(templateKey: string): EmailTemplate | null {
    const defaults: Record<string, Partial<EmailTemplate>> = {
      order_confirmation: {
        template_key: 'order_confirmation',
        template_name: 'Order Confirmation',
        subject_template: 'Order Confirmation - {{order_number}}',
        html_template: `
          <h1>Order Confirmation</h1>
          <p>Hello {{customer_name}},</p>
          <p>Thank you for your order! Your order <strong>{{order_number}}</strong> has been confirmed.</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3>Order Details:</h3>
            <p><strong>Order Number:</strong> {{order_number}}</p>
            <p><strong>Total Amount:</strong> {{order_total}}</p>
            <p><strong>Order Date:</strong> {{order_date}}</p>
          </div>
          <p>We will send you updates as your order progresses.</p>
          <p>Thank you for choosing {{store_name}}!</p>
        `,
        text_template: 'Order Confirmation - {{order_number}}\n\nHello {{customer_name}}, your order {{order_number}} for {{order_total}} has been confirmed.',
        variables: ['customer_name', 'order_number', 'order_total', 'order_date', 'store_name'],
        template_type: 'transactional',
        is_active: true
      },
      customer_welcome: {
        template_key: 'customer_welcome',
        template_name: 'Welcome Email',
        subject_template: 'Welcome to {{store_name}}, {{customer_name}}!',
        html_template: `
          <h1>Welcome to {{store_name}}!</h1>
          <p>Hello {{customer_name}},</p>
          <p>Thank you for joining us! We're excited to have you as part of our community.</p>
          <p>Start exploring our products and enjoy shopping with us.</p>
          <p>If you have any questions, feel free to contact us at {{support_email}}.</p>
          <p>Welcome aboard!</p>
        `,
        text_template: 'Welcome to {{store_name}}!\n\nHello {{customer_name}}, thank you for joining us!',
        variables: ['customer_name', 'store_name', 'support_email'],
        template_type: 'transactional',
        is_active: true
      }
    };

    const defaultTemplate = defaults[templateKey];
    if (!defaultTemplate) return null;

    return {
      id: `default-${templateKey}`,
      ...defaultTemplate
    } as EmailTemplate;
  }
}

export const emailTemplateService = new EmailTemplateService();