import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  templateId: string;
  to: string;
  variables: Record<string, any>;
  emailType: 'transactional' | 'marketing';
  priority?: 'high' | 'normal' | 'low';
}

// Email templates
const emailTemplates = {
  admin_welcome: {
    subject: 'Welcome to Starters Small Chops Admin Panel',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f59e0b; margin: 0;">Starters Small Chops</h1>
          <p style="color: #666; margin: 5px 0;">Admin Panel Access</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Welcome to the Team!</h2>
          <p>You have been granted <strong>{{role}}</strong> access to the Starters Small Chops admin panel.</p>
          
          {{#if immediate_access}}
          <div style="background: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0;">
            <h3 style="color: #f59e0b; margin-top: 0;">Immediate Access Credentials</h3>
            <p><strong>Email:</strong> {{to}}</p>
            <p><strong>Password:</strong> <code style="background: #f3f4f6; padding: 2px 4px;">{{password}}</code></p>
            <p style="color: #dc2626; font-size: 14px;"><strong>Important:</strong> Please change your password after your first login.</p>
          </div>
          {{/if}}
          
          <div style="margin: 20px 0;">
            <a href="{{login_url}}" style="background: #f59e0b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block;">
              Access Admin Panel
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Created by: {{created_by}}<br>
            Role: {{role}}<br>
            Date: {{date}}
          </p>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #92400e; margin-top: 0;">Security Reminders</h3>
          <ul style="color: #92400e; margin: 0; padding-left: 20px;">
            <li>Never share your login credentials</li>
            <li>Use a strong, unique password</li>
            <li>Enable two-factor authentication when available</li>
            <li>Log out when not using the system</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #666; font-size: 12px;">
            This is an automated message. Please do not reply to this email.<br>
            If you have questions, contact your system administrator.
          </p>
        </div>
      </div>
    `
  },
  
  admin_invitation: {
    subject: 'Admin Invitation - Starters Small Chops',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f59e0b; margin: 0;">Starters Small Chops</h1>
          <p style="color: #666; margin: 5px 0;">Admin Invitation</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-top: 0;">You're Invited!</h2>
          <p>You have been invited to join the Starters Small Chops admin team with <strong>{{role}}</strong> privileges.</p>
          
          <div style="margin: 20px 0; text-align: center;">
            <a href="{{invitation_url}}" style="background: #f59e0b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This invitation will expire in 7 days. If you did not expect this invitation, please ignore this email.
          </p>
        </div>
      </div>
    `
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: EmailRequest = await req.json();

    if (!body.templateId || !body.to || !body.variables) {
      throw new Error('templateId, to, and variables are required');
    }

    // Get template
    const template = emailTemplates[body.templateId as keyof typeof emailTemplates];
    if (!template) {
      throw new Error(`Template ${body.templateId} not found`);
    }

    // Add current date to variables
    body.variables.date = new Date().toLocaleDateString();

    // Simple template rendering (replace {{variable}} with values)
    let htmlContent = template.html;
    let subject = template.subject;

    // Handle conditional blocks {{#if variable}}...{{/if}}
    htmlContent = htmlContent.replace(/\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
      const value = body.variables[condition.trim()];
      return value ? content : '';
    });

    // Replace variables
    Object.entries(body.variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      htmlContent = htmlContent.replace(regex, String(value || ''));
      subject = subject.replace(regex, String(value || ''));
    });

    // Queue email in communication_events
    const { error: queueError } = await supabase
      .from('communication_events')
      .insert({
        event_type: body.templateId,
        recipient_email: body.to,
        template_key: body.templateId,
        email_type: body.emailType,
        priority: body.priority || 'normal',
        variables: body.variables,
        template_variables: {
          subject: subject,
          html: htmlContent
        },
        status: 'queued',
        scheduled_at: new Date().toISOString()
      });

    if (queueError) {
      console.error('[ADMIN-EMAIL] Failed to queue email:', queueError);
      throw new Error(`Failed to queue email: ${queueError.message}`);
    }

    // Try to send immediately via email processor
    try {
      await supabase.functions.invoke('enhanced-email-processor', {
        body: {
          template_id: body.templateId,
          recipient_email: body.to,
          variables: body.variables,
          subject: subject,
          html_content: htmlContent
        }
      });
      console.log('[ADMIN-EMAIL] Email sent successfully');
    } catch (sendError) {
      console.warn('[ADMIN-EMAIL] Immediate send failed, will be processed by queue:', sendError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Email queued and sent successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[ADMIN-EMAIL] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});