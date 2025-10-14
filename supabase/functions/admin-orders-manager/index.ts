import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
  }
  
  const corsHeaders = getCorsHeaders(origin);

  try {
    // 🔒 SECURITY: Extract and verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    // 🔒 SECURITY: Create anon client for JWT verification
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // 🔒 SECURITY: Verify user authentication
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    // 🔒 SECURITY: Verify admin privileges using is_admin() function
    const { data: isAdminCheck, error: adminCheckError } = await supabaseAnon
      .rpc('is_admin');

    if (adminCheckError) {
      console.error('Admin check failed:', adminCheckError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization check failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    if (!isAdminCheck) {
      // 🚨 SECURITY: Log unauthorized access attempt
      const supabaseService = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseService.from('audit_logs').insert({
        action: 'unauthorized_order_update_attempt',
        category: 'Security',
        message: 'Non-admin user attempted to update order via edge function',
        user_id: user.id,
        new_values: { email: user.email, timestamp: new Date().toISOString() }
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Forbidden - Admin access required' 
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    // 🔒 SECURITY: Now safe to use service role for the actual update
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, orderId, updates } = await req.json();

    // Validate orderId is a valid UUID
    if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid order ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    // Validate updates object
    if (!updates || typeof updates !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid updates' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    // 🔒 SECURITY: Define admin-only fields with strict validation
    const ADMIN_ONLY_FIELDS = ['status', 'assigned_rider_id', 'payment_status', 'admin_notes', 'delivery_fee'];
    const ALLOWED_CUSTOMER_FIELDS = ['special_instructions']; // Only customers can update this
    const ALL_ALLOWED_FIELDS = [...ADMIN_ONLY_FIELDS, ...ALLOWED_CUSTOMER_FIELDS];
    
    // Validate all fields are in allowed list
    const attemptedFields = Object.keys(updates);
    const invalidFields = attemptedFields.filter(key => !ALL_ALLOWED_FIELDS.includes(key));
    
    if (invalidFields.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid fields: ${invalidFields.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    // 🔒 SECURITY: Field-level permission check for admin-only fields
    const restrictedFieldsAttempted = attemptedFields.filter(field => 
      ADMIN_ONLY_FIELDS.includes(field)
    );
    
    if (restrictedFieldsAttempted.length > 0) {
      // Log security violation attempt
      await supabaseService.from('audit_logs').insert({
        action: 'unauthorized_field_update_attempt',
        category: 'Security Violation',
        message: `Admin-only fields update attempted: ${restrictedFieldsAttempted.join(', ')}`,
        user_id: user.id,
        entity_id: orderId,
        new_values: { 
          attempted_fields: restrictedFieldsAttempted,
          email: user.email,
          timestamp: new Date().toISOString()
        }
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Forbidden - Cannot update restricted fields',
          restricted_fields: restrictedFieldsAttempted,
          message: 'Only administrators can modify status, payment information, and driver assignments'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    if (action === 'update') {
      // Log the admin action
      await supabaseService.from('audit_logs').insert({
        action: 'order_updated_via_edge_function',
        category: 'Order Management',
        message: `Admin ${user.email} updated order ${orderId}`,
        user_id: user.id,
        entity_id: orderId,
        new_values: { ...updates, updated_by: user.id }
      });

      const { data, error } = await supabaseService
        .from('orders')
        .update({ 
          ...updates, 
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, order: data }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
    );
  } catch (error: any) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
    );
  }
};

serve(handler);