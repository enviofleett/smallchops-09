import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment-aware CORS headers for production security
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Allow any Lovable project domain for development/preview
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.lovableproject.com', // Production
    /^https:\/\/[\w-]+\.lovableproject\.com$/ // Dev/Preview domains
  ];
  
  const isAllowed = origin && allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://oknnklksdiqaifhxaccs.lovableproject.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log(`Business settings request: ${req.method} from ${origin}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Enhanced auth header validation
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    if (!user.user) {
      throw new Error('User not found');
    }

    console.log('User authenticated:', user.user.id);

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      throw new Error(`Failed to get user profile: ${profileError.message}`);
    }

    console.log('User role:', profile?.role);

    if (profile?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    if (req.method === 'GET') {
      const { data: settings, error } = await supabaseClient
        .from('business_settings')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return new Response(
        JSON.stringify({ data: settings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle POST (functions.invoke defaults to POST)
    if (req.method === 'POST') {
      console.log('Processing POST request for business settings');
      
      let reqBody;
      try {
        reqBody = await req.json();
        console.log('Request body received:', Object.keys(reqBody));
      } catch (error) {
        console.error('Failed to parse JSON body:', error);
        throw new Error('Invalid JSON in request body');
      }

      // Handle communication settings updates
      if (reqBody?.action === 'update_communication_settings') {
        const { settings } = reqBody;
        console.log('Updating communication settings:', settings);

        // Check if record exists
        const { data: existingSettings } = await supabaseClient
          .from('communication_settings')
          .select('id')
          .single();

        let result;
        if (existingSettings) {
          // Update existing record
          result = await supabaseClient
            .from('communication_settings')
            .update({
              ...settings,
              updated_at: new Date().toISOString(),
              connected_by: user.user.id
            })
            .eq('id', existingSettings.id)
            .select()
            .single();
        } else {
          // Insert new record
          result = await supabaseClient
            .from('communication_settings')
            .insert({
              ...settings,
              connected_by: user.user.id
            })
            .select()
            .single();
        }

        if (result.error) {
          console.error('Error updating communication settings:', result.error);
          throw new Error(`Failed to update communication settings: ${result.error.message}`);
        }

        console.log('Communication settings updated successfully');
        return new Response(JSON.stringify({
          success: true,
          data: result.data,
          message: 'Communication settings updated successfully'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle test email connection
      if (reqBody?.action === 'test_email_connection') {
        console.log('Testing email connection...');

        // Get MailerSend API token from environment
        const mailersendToken = Deno.env.get('MAILERSEND_API_TOKEN');
        
        if (!mailersendToken) {
          console.error('MailerSend API token not configured');
          return new Response(JSON.stringify({
            success: false,
            error: 'MailerSend API token not configured in Supabase secrets. Please add MAILERSEND_API_TOKEN to your edge function secrets.'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get current communication settings
        const { data: settings, error: settingsError } = await supabaseClient
          .from('communication_settings')
          .select('*')
          .single();

        if (settingsError) {
          console.error('Error fetching communication settings:', settingsError);
          return new Response(JSON.stringify({
            success: false,
            error: 'No communication settings found. Please configure your email settings first.'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!settings.sender_email) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Sender email not configured. Please set a sender email address.'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Call the send-email function to test the connection
        try {
          const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-email', {
            body: {
              to: settings.sender_email, // Send test email to sender
              subject: 'MailerSend Test Email - Connection Successful',
              html: `
                <h2>Test Email Successful!</h2>
                <p>Your MailerSend configuration is working correctly.</p>
                <p>Sender: ${settings.smtp_user || settings.sender_email}</p>
                <p>Domain: ${settings.mailersend_domain || 'Default domain'}</p>
                <p>Time: ${new Date().toISOString()}</p>
              `,
              order_id: null // Optional field for test emails
            }
          });

          if (emailError) {
            console.error('Email test failed:', emailError);
            return new Response(JSON.stringify({
              success: false,
              error: `Email test failed: ${emailError.message}`
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log('Email test successful');
          return new Response(JSON.stringify({
            success: true,
            message: 'Test email sent successfully! Check your inbox.'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (error) {
          console.error('Email test error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to send test email: ${error.message}`
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Handle email template updates
      if (reqBody?.action === 'update_email_templates') {
        const { templates } = reqBody;
        console.log('Updating email templates:', Object.keys(templates));

        // Check if record exists
        const { data: existingSettings } = await supabaseClient
          .from('communication_settings')
          .select('id')
          .single();

        let result;
        if (existingSettings) {
          // Update existing record
          result = await supabaseClient
            .from('communication_settings')
            .update({
              email_templates: templates,
              updated_at: new Date().toISOString(),
              connected_by: user.user.id
            })
            .eq('id', existingSettings.id)
            .select()
            .single();
        } else {
          // Insert new record
          result = await supabaseClient
            .from('communication_settings')
            .insert({
              email_templates: templates,
              connected_by: user.user.id
            })
            .select()
            .single();
        }

        if (result.error) {
          console.error('Error updating email templates:', result.error);
          throw new Error(`Failed to update email templates: ${result.error.message}`);
        }

        console.log('Email templates updated successfully');
        return new Response(JSON.stringify({
          success: true,
          data: result.data,
          message: 'Email templates updated successfully'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle regular business settings update
      const body = reqBody;
      
      // Validate required fields
      if (!body.name || body.name.trim().length === 0) {
        throw new Error('Business name is required');
      }

      // Validate email format if provided
      if (body.email && body.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        throw new Error('Invalid email format');
      }

      // Validate URLs if provided
      const urlFields = ['website_url', 'facebook_url', 'instagram_url', 'tiktok_url', 'twitter_url', 'linkedin_url', 'youtube_url'];
      for (const field of urlFields) {
        if (body[field] && body[field].trim() !== '') {
          try {
            new URL(body[field]);
          } catch {
            throw new Error(`Invalid URL format for ${field}`);
          }
        }
      }

      // Clean up empty strings to null for database
      const cleanedBody = { ...body };
      Object.keys(cleanedBody).forEach(key => {
        if (cleanedBody[key] === '') {
          cleanedBody[key] = null;
        }
      });

      console.log('Checking for existing settings...');
      
      // Check if settings exist
      const { data: existing, error: existingError } = await supabaseClient
        .from('business_settings')
        .select('id')
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        console.error('Error checking existing settings:', existingError);
        throw new Error(`Database error: ${existingError.message}`);
      }

      let result;
      if (existing) {
        console.log('Updating existing settings with ID:', existing.id);
        // Update existing settings
        const { data, error } = await supabaseClient
          .from('business_settings')
          .update(cleanedBody)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) {
          console.error('Update error:', error);
          throw new Error(`Failed to update settings: ${error.message}`);
        }
        result = data;
      } else {
        console.log('Creating new settings...');
        // Insert new settings
        const { data, error } = await supabaseClient
          .from('business_settings')
          .insert(cleanedBody)
          .select()
          .single();
        
        if (error) {
          console.error('Insert error:', error);
          throw new Error(`Failed to create settings: ${error.message}`);
        }
        result = data;
      }

      console.log('Settings operation successful');

      return new Response(
        JSON.stringify({ data: result }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Business settings error:', error);
    
    // Determine appropriate status code
    let status = 400;
    if (error.message.includes('Unauthorized') || error.message.includes('Admin access required')) {
      status = 403;
    } else if (error.message.includes('Authentication failed') || error.message.includes('Authorization header missing')) {
      status = 401;
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack || 'No additional details'
      }),
      { 
        status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})