import { supabase } from "@/integrations/supabase/client";

export interface TemplateValidationResult {
  isValid: boolean;
  missingTemplates: string[];
  viewConsistency: {
    isConsistent: boolean;
    issues: string[];
  };
  recommendations: string[];
}

// Template keys that should exist for the email system to work properly
const REQUIRED_TEMPLATE_KEYS = [
  'order_confirmed',
  'order_completed', 
  'out_for_delivery',
  'admin_new_order',
  'customer_welcome',
  'order_canceled',
  'payment_confirmed'
];

export async function validateEmailTemplates(): Promise<TemplateValidationResult> {
  try {
    // Check templates in enhanced_email_templates
    const { data: templates, error } = await supabase
      .from('enhanced_email_templates')
      .select('template_key, is_active, template_name')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    const existingKeys = templates?.map(t => t.template_key) || [];
    const missingTemplates = REQUIRED_TEMPLATE_KEYS.filter(key => !existingKeys.includes(key));

    // Check view consistency
    const { data: viewTemplates, error: viewError } = await supabase
      .from('email_templates')
      .select('template_key');

    const viewKeys = viewTemplates?.map(t => t.template_key) || [];
    const viewIssues: string[] = [];

    const viewMissingFromTable = viewKeys.filter(key => !existingKeys.includes(key));
    const tableMissingFromView = existingKeys.filter(key => !viewKeys.includes(key));

    if (viewMissingFromTable.length > 0) {
      viewIssues.push(`Templates in view but not in table: ${viewMissingFromTable.join(', ')}`);
    }
    if (tableMissingFromView.length > 0) {
      viewIssues.push(`Templates in table but not in view: ${tableMissingFromView.join(', ')}`);
    }

    const recommendations: string[] = [];
    if (missingTemplates.length > 0) {
      recommendations.push(`Create missing email templates: ${missingTemplates.join(', ')}`);
      recommendations.push('Go to Admin → Email Settings → Template Manager to add the missing templates');
    }
    if (viewIssues.length > 0) {
      recommendations.push('Contact support to fix email_templates view inconsistencies');
    }
    if (missingTemplates.length === 0 && viewIssues.length === 0) {
      recommendations.push('All email templates are properly configured! 🎉');
    }

    return {
      isValid: missingTemplates.length === 0 && viewIssues.length === 0,
      missingTemplates,
      viewConsistency: {
        isConsistent: viewIssues.length === 0,
        issues: viewIssues
      },
      recommendations
    };

  } catch (error) {
    console.error('Email template validation error:', error);
    return {
      isValid: false,
      missingTemplates: [],
      viewConsistency: {
        isConsistent: false,
        issues: [`Validation failed: ${error.message}`]
      },
      recommendations: ['Check database connection and permissions']
    };
  }
}

export async function checkTemplateAvailability(templateKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('enhanced_email_templates')
      .select('template_key')
      .eq('template_key', templateKey)
      .eq('is_active', true)
      .maybeSingle();

    return !error && !!data;
  } catch (error) {
    console.error(`Failed to check template availability for ${templateKey}:`, error);
    return false;
  }
}