import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template keys that should exist in the database
// Required templates that match existing and new ones
const REQUIRED_TEMPLATES = [
  'order_confirmation',    // Order confirmed by admin (exists)
  'order_processing',      // Order is being prepared (exists)
  'order_ready',          // Order ready for pickup (exists)
  'out_for_delivery',     // Order out for delivery (exists)
  'order_completed',      // Order delivered/completed (exists)
  'order_canceled',       // Order cancelled (need to create)
  'payment_confirmation', // Payment confirmed (exists)
  'admin_new_order',      // Admin notification for new orders (exists)
  'customer_welcome'      // Customer welcome email (exists)
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('🔍 Running email template consistency check...');

    // Check which templates exist in the database
    const { data: existingTemplates, error: templatesError } = await supabase
      .from('enhanced_email_templates')
      .select('template_key, is_active, template_name')
      .eq('is_active', true);

    if (templatesError) {
      throw new Error(`Failed to fetch templates: ${templatesError.message}`);
    }

    const existingKeys = existingTemplates?.map(t => t.template_key) || [];
    const missingTemplates = REQUIRED_TEMPLATES.filter(key => !existingKeys.includes(key));
    const extraTemplates = existingKeys.filter(key => !REQUIRED_TEMPLATES.includes(key));

    // Check email_templates view consistency
    const { data: viewTemplates, error: viewError } = await supabase
      .from('email_templates')
      .select('template_key, template_name');

    const viewKeys = viewTemplates?.map(t => t.template_key) || [];
    const viewMissingFromTable = viewKeys.filter(key => !existingKeys.includes(key));
    const tableMissingFromView = existingKeys.filter(key => !viewKeys.includes(key));

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      templates: {
        required: REQUIRED_TEMPLATES,
        existing: existingKeys,
        missing: missingTemplates,
        extra: extraTemplates
      },
      view_consistency: {
        view_missing_from_table: viewMissingFromTable,
        table_missing_from_view: tableMissingFromView,
        is_consistent: viewMissingFromTable.length === 0 && tableMissingFromView.length === 0
      },
      health_status: missingTemplates.length === 0 ? 'healthy' : 'missing_templates',
      recommendations: [
        ...(missingTemplates.length > 0 ? [`Add missing templates: ${missingTemplates.join(', ')}`] : []),
        ...(viewMissingFromTable.length > 0 ? [`Fix view inconsistency - missing from table: ${viewMissingFromTable.join(', ')}`] : []),
        ...(tableMissingFromView.length > 0 ? [`Fix view inconsistency - missing from view: ${tableMissingFromView.join(', ')}`] : [])
      ]
    };

    console.log('📊 Template consistency check results:', {
      totalRequired: REQUIRED_TEMPLATES.length,
      totalExisting: existingKeys.length,
      missing: missingTemplates.length,
      extra: extraTemplates.length,
      viewConsistent: result.view_consistency.is_consistent
    });

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Email template checker error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to check email template consistency'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});