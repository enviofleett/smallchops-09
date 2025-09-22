import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Import shared CORS with inline fallback for production stability
let getCorsHeaders;
let handleCorsPreflightResponse;
try {
  const corsModule = await import('../_shared/cors.ts');
  getCorsHeaders = corsModule.getCorsHeaders;
  handleCorsPreflightResponse = corsModule.handleCorsPreflightResponse;
  console.log('✅ Loaded shared CORS module');
} catch (error) {
  console.warn('⚠️ Failed to load shared CORS, using inline fallback:', error);
  const FALLBACK_ALLOWED_ORIGINS = [
    'https://startersmallchops.com',
    'https://www.startersmallchops.com',
    'https://oknnklksdiqaifhxaccs.lovable.app',
    'https://id-preview--7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovable.app',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.sandbox.lovable.dev',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  const DEV_PATTERNS = [
    /^https:\/\/.*\.lovable\.app$/,
    /^https:\/\/.*\.sandbox\.lovable\.dev$/,
    /^http:\/\/localhost:\d+$/
  ];
  
  getCorsHeaders = (origin) => {
    const baseHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Credentials': 'false'
    };
    
    if (!origin || (!FALLBACK_ALLOWED_ORIGINS.includes(origin) && !DEV_PATTERNS.some(pattern => pattern.test(origin)))) {
      return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': '*'
      };
    }
    
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin'
    };
  };
  
  handleCorsPreflightResponse = (origin) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin)
    });
  };
}

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '', 
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Enhanced admin authentication function
async function authenticateAdmin(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('⚠️ No authorization header found');
      return { success: false, error: 'No authorization header' };
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔍 Attempting to authenticate with token length:', token.length);
    
    // Create a temporary client with the user's JWT for user context
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get user from token using the user context client
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.log('⚠️ Invalid token or user not found:', userError?.message || 'No user data');
      return { success: false, error: 'Invalid token or user not found' };
    }

    console.log('✅ User authenticated:', { userId: user.id, email: user.email });

    // Check if user is admin via profiles table using service role client
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.log('⚠️ Error fetching user profile:', profileError.message);
      return { success: false, error: 'Error fetching user profile' };
    }

    if (!profile || profile.role !== 'admin' || !profile.is_active) {
      console.log('⚠️ User is not an active admin:', { role: profile?.role, is_active: profile?.is_active });
      return { success: false, error: 'Insufficient permissions' };
    }

    console.log('✅ Admin authentication successful:', {
      userId: user.id,
      email: user.email,
      role: profile.role,
      authMethod: 'profiles_table',
      timestamp: new Date().toISOString()
    });

    return { 
      success: true, 
      user: user,
      profile: profile
    };
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return { success: false, error: 'Authentication failed' };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  console.log('🚀 Order Manager: POST request from origin:', origin, `[req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}]`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
  }

  try {
    // Authenticate admin
    const authResult = await authenticateAdmin(req);
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: authResult.error }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(origin)
          }
        }
      );
    }

    // Safe JSON parsing with validation
    let body;
    try {
      const bodyText = await req.text();
      console.log('📥 Raw request body length:', bodyText.length);
      
      if (!bodyText || bodyText.trim() === '') {
        throw new Error('Empty request body');
      }
      
      body = JSON.parse(bodyText);
      console.log('✅ JSON parsed successfully:', { action: body.action || 'undefined' });
    } catch (jsonError) {
      console.error('❌ JSON parsing error:', jsonError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(origin)
          }
        }
      );
    }

    const { action } = body;

    console.log('📋 Processing admin request:', {
      action: action || 'undefined',
      orderId: body.order_id || 'N/A',
      timestamp: new Date().toISOString()
    });

    switch (action) {
      case 'list_orders':
        return await handleListOrders(body, origin);
      
      case 'update_status':
        return await handleUpdateStatus(body, authResult.user, origin);
      
      case 'assign_rider':
        return await handleAssignRider(body, authResult.user, origin);
      
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { 
              'Content-Type': 'application/json',
              ...getCorsHeaders(origin)
            }
          }
        );
    }
  } catch (error) {
    console.error('❌ Order Manager Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      }
    );
  }
});

async function handleListOrders(body, origin) {
  const { 
    page = 1, 
    page_size = 20, 
    status_filter = 'all', 
    search_query = '',
    start_date,
    end_date
  } = body;

  console.log('Admin function: Listing orders', {
    page,
    pageSize: page_size,
    status: status_filter,
    searchQuery: search_query,
    startDate: start_date,
    endDate: end_date
  });

  try {
    let query = supabaseClient
      .from('orders')
      .select(`
        *,
        order_items(*)
      `, { count: 'exact' });

    // Apply filters
    if (status_filter !== 'all') {
      query = query.eq('status', status_filter);
    }

    if (search_query) {
      query = query.or(`customer_name.ilike.%${search_query}%,customer_email.ilike.%${search_query}%,order_number.ilike.%${search_query}%`);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply pagination
    const offset = (page - 1) * page_size;
    query = query
      .range(offset, offset + page_size - 1)
      .order('created_at', { ascending: false });

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('❌ Database error:', error.message);
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          orders: orders || [], 
          total_count: count || 0 
        } 
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      }
    );
  } catch (error) {
    console.error('❌ List orders error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      }
    );
  }
}

async function handleUpdateStatus(body, user, origin) {
  const { order_id, new_status, admin_name = 'Admin' } = body;

  if (!order_id || !new_status) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing order_id or new_status' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      }
    );
  }

  try {
    // Use the enhanced function with guaranteed email notifications
    const { data, error } = await supabaseClient.rpc('admin_update_order_status_enhanced_notifications', {
      p_order_id: order_id,
      p_new_status: new_status,
      p_admin_id: user.id
    });

    if (error) {
      console.error('❌ Order update error:', error.message);
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      }
    );
  } catch (error) {
    console.error('❌ Update status error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      }
    );
  }
}

async function handleAssignRider(body, user, origin) {
  const { order_id, rider_id, rider_name } = body;

  if (!order_id || !rider_id) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing order_id or rider_id' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      }
    );
  }

  try {
    // Update order with rider assignment
    const { data, error } = await supabaseClient
      .from('orders')
      .update({ 
        assigned_rider_id: rider_id,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('id', order_id)
      .select()
      .single();

    if (error) {
      console.error('❌ Rider assignment error:', error.message);
      throw error;
    }

    // Log the assignment
    await supabaseClient.from('audit_logs').insert({
      action: 'rider_assigned',
      category: 'Order Management',
      message: `Rider ${rider_name} assigned to order ${data.order_number}`,
      user_id: user.id,
      entity_id: order_id,
      new_values: {
        rider_id: rider_id,
        rider_name: rider_name
      }
    });

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      }
    );
  } catch (error) {
    console.error('❌ Assign rider error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      }
    );
  }
}