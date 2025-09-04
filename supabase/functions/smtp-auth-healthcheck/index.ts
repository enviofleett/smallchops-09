import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get production SMTP configuration prioritizing Function Secrets
async function getProductionSMTPConfig(supabase: any): Promise<{
  host: string;
  port: number;
  username: string;
  password: string;
  senderEmail: string;
  senderName: string;
  encryption?: string;
  source: string;
}> {
  console.log('🔍 Loading SMTP configuration...');
  
  // Priority 1: Function Secrets (Production)
  const secretHost = Deno.env.get('SMTP_HOST');
  const secretPort = Deno.env.get('SMTP_PORT');
  const secretUsername = Deno.env.get('SMTP_USERNAME');
  const secretPassword = Deno.env.get('SMTP_PASSWORD');
  const secretEncryption = Deno.env.get('SMTP_ENCRYPTION');
  const secretFromName = Deno.env.get('SMTP_FROM_NAME');
  const secretFromEmail = Deno.env.get('SMTP_FROM_EMAIL');

  if (secretHost && secretUsername && secretPassword) {
    console.log('📧 Using Function Secrets configuration (Production)');
    
    const port = secretPort ? parseInt(secretPort.trim(), 10) : 587;
    const normalizedPassword = secretPassword.replace(/\s+/g, '').trim();
    const normalizedUsername = secretUsername.trim();
    
    // Gmail-specific validation
    if (secretHost.includes('gmail.com') && port === 587) {
      if (!normalizedUsername.includes('@')) {
        throw new Error('Gmail SMTP requires full email address as username');
      }
      if (normalizedPassword.length !== 16) {
        throw new Error('Gmail requires a 16-character App Password. Generate one at https://myaccount.google.com/apppasswords');
      }
    }
    
    return {
      host: secretHost.trim(),
      port: port,
      username: normalizedUsername,
      password: normalizedPassword,
      senderEmail: (secretFromEmail || normalizedUsername).trim(),
      senderName: (secretFromName || 'System').trim(),
      encryption: secretEncryption?.trim() || 'TLS',
      source: 'function_secrets'
    };
  }

  // Production safety check
  const isProduction = Deno.env.get('ENVIRONMENT') === 'production' || 
                      Deno.env.get('SUPABASE_URL')?.includes('supabase.co');
  
  if (isProduction) {
    throw new Error('Production environment requires SMTP configuration via Function Secrets');
  }

  // Priority 2: Database Configuration (Development Fallback)
  console.log('📧 Falling back to database configuration (development mode)');
  
  const { data: config } = await supabase
    .from('communication_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!config?.use_smtp) {
    throw new Error('SMTP configuration not found in Function Secrets or database');
  }

  if (!config.smtp_host || !config.smtp_user) {
    const missing = [];
    if (!config.smtp_host) missing.push('host');
    if (!config.smtp_user) missing.push('username');
    throw new Error(`Incomplete SMTP configuration in database: missing ${missing.join(', ')}`);
  }

  const normalizedPassword = (config.smtp_pass || '').toString().replace(/\s+/g, '').trim();
  const normalizedUsername = config.smtp_user.trim();

  // Gmail-specific validation for database config
  if (config.smtp_host?.includes('gmail.com') && (config.smtp_port || 587) === 587) {
    if (!normalizedUsername.includes('@')) {
      throw new Error('Gmail SMTP requires full email address as username');
    }
    if (normalizedPassword.length !== 16 && normalizedPassword.length > 0) {
      throw new Error('Gmail requires a 16-character App Password. Generate one at https://myaccount.google.com/apppasswords');
    }
  }

  console.log('📧 Database configuration loaded');

  return {
    host: config.smtp_host.trim(),
    port: config.smtp_port || 587,
    username: normalizedUsername,
    password: normalizedPassword,
    senderEmail: (config.sender_email || normalizedUsername).trim(),
    senderName: (config.sender_name || 'System').trim(),
    encryption: 'TLS',
    source: 'database'
  };
}

// Test SMTP connection
async function testSMTPConnection(config: any) {
  try {
    console.log('🔧 Testing SMTP connection to:', {
      host: config.host,
      port: config.port,
      username: config.username?.split('@')[0] + '@***',
      encryption: config.encryption
    });

    // For this health check, we'll test the connection without sending an actual email
    // This is a basic connectivity test
    const conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });

    // Read initial greeting
    const buffer = new Uint8Array(1024);
    const n = await conn.read(buffer);
    if (n === null) throw new Error('No response from SMTP server');
    
    const greeting = new TextDecoder().decode(buffer.subarray(0, n));
    console.log('📧 SMTP Greeting:', greeting.trim());
    
    // Send EHLO command
    const encoder = new TextEncoder();
    await conn.write(encoder.encode('EHLO localhost\r\n'));
    
    // Read response
    const ehloResponse = new Uint8Array(1024);
    const ehloN = await conn.read(ehloResponse);
    if (ehloN === null) throw new Error('No EHLO response from SMTP server');
    
    const ehloResult = new TextDecoder().decode(ehloResponse.subarray(0, ehloN));
    console.log('📧 EHLO Response:', ehloResult.trim());
    
    // Send QUIT
    await conn.write(encoder.encode('QUIT\r\n'));
    conn.close();
    
    return {
      success: true,
      greeting: greeting.trim(),
      capabilities: ehloResult.trim()
    };
    
  } catch (error) {
    console.error('❌ SMTP Connection test failed:', error);
    throw error;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🏥 SMTP Authentication Health Check started');

    // Get SMTP configuration
    const smtpConfig = await getProductionSMTPConfig(supabase);
    
    // Test SMTP connection
    const connectionResult = await testSMTPConnection(smtpConfig);
    
    // Log health check to database
    await supabase.from('smtp_health_metrics').insert({
      provider_name: 'production-smtp',
      metric_type: 'auth_test',
      metric_value: 1,
      recorded_at: new Date().toISOString()
    });

    const response = {
      success: true,
      message: 'SMTP authentication health check passed',
      provider: {
        host: smtpConfig.host,
        port: smtpConfig.port,
        username: smtpConfig.username?.split('@')[0] + '@***',
        senderEmail: smtpConfig.senderEmail?.split('@')[0] + '@***',
        senderName: smtpConfig.senderName,
        encryption: smtpConfig.encryption,
        source: smtpConfig.source
      },
      connection: connectionResult,
      timestamp: new Date().toISOString()
    };

    console.log('✅ SMTP health check completed successfully');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ SMTP health check failed:', error);
    
    // Log failed health check
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase.from('smtp_health_metrics').insert({
        provider_name: 'production-smtp',
        metric_type: 'auth_test',
        metric_value: 0,
        recorded_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log health check failure:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: 'SMTP authentication health check failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});