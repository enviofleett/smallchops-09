import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for dual user type violation
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    const { data: customerAccount } = await supabase
      .from('customer_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasBothTypes = !!profile && !!customerAccount;

    if (hasBothTypes) {
      // CRITICAL SECURITY VIOLATION
      console.error(`🚨 SECURITY BREACH: User ${user.email} has both admin and customer accounts!`);
      
      // Log violation using the database function
      await supabase.rpc('log_privilege_escalation_attempt', {
        p_user_id: user.id,
        p_email: user.email || '',
        p_violation_type: 'dual_user_type_detected',
        p_details: {
          profile_role: profile.role,
          customer_account_id: customerAccount.id,
          detected_at: new Date().toISOString()
        }
      });

      // Force user to customer type (safer default) - delete admin privileges
      await supabase.from('profiles').delete().eq('id', user.id);
      await supabase.from('user_roles').delete().eq('user_id', user.id);

      return new Response(JSON.stringify({
        isValid: false,
        userType: 'customer',
        violation: 'dual_type_detected',
        message: 'Your account has been corrected. Please log out and log back in.'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      isValid: true,
      userType: profile ? 'admin' : 'customer',
      hasProfile: !!profile,
      hasCustomerAccount: !!customerAccount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('User type validation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
