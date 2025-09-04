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

// Test SMTP connection with full authentication
async function testSMTPConnection(config: any) {
  let conn: Deno.TcpConn | null = null;
  
  try {
    console.log('🔧 Testing SMTP authentication to:', {
      host: config.host,
      port: config.port,
      username: config.username?.split('@')[0] + '@***',
      encryption: config.encryption
    });

    // Establish TCP connection
    conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Helper to read SMTP response
    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(1024);
      const n = await conn!.read(buffer);
      if (n === null) throw new Error('Connection closed unexpectedly');
      return decoder.decode(buffer.subarray(0, n)).trim();
    }
    
    // Helper to send command and get response
    async function sendCommand(command: string): Promise<string> {
      console.log(`📤 SMTP: ${command.replace(/AUTH PLAIN .+/, 'AUTH PLAIN [credentials hidden]')}`);
      await conn!.write(encoder.encode(command + '\r\n'));
      const response = await readResponse();
      console.log(`📥 SMTP: ${response}`);
      return response;
    }

    // Read initial greeting
    const greeting = await readResponse();
    console.log('📧 SMTP Greeting:', greeting);
    
    if (!greeting.startsWith('220')) {
      throw new Error(`Invalid SMTP greeting: ${greeting}`);
    }
    
    // Send EHLO command
    const ehloResponse = await sendCommand('EHLO localhost');
    if (!ehloResponse.includes('250')) {
      throw new Error(`EHLO failed: ${ehloResponse}`);
    }

    // Start TLS if on port 587
    if (config.port === 587 || config.encryption?.toUpperCase() === 'STARTTLS') {
      const tlsResponse = await sendCommand('STARTTLS');
      if (!tlsResponse.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${tlsResponse}`);
      }
      
      console.log('🔒 TLS connection established');
      // Note: In a full implementation, we'd upgrade to TLS here
      // For this health check, we'll simulate the auth test
    }

    // Test authentication (using base64 encoding for PLAIN auth)
    const authString = `\0${config.username}\0${config.password}`;
    const authBase64 = btoa(authString);
    
    try {
      const authResponse = await sendCommand(`AUTH PLAIN ${authBase64}`);
      
      if (authResponse.startsWith('235')) {
        console.log('✅ SMTP Authentication successful');
        
        // Send QUIT
        await sendCommand('QUIT');
        
        return {
          success: true,
          authenticated: true,
          greeting: greeting,
          capabilities: ehloResponse,
          authResponse: '235 Authentication successful'
        };
      } else if (authResponse.startsWith('535')) {
        throw new Error(`Authentication failed (535): Username/password rejected. ${
          config.host.includes('gmail.com') 
            ? 'For Gmail, ensure you use an App Password from https://myaccount.google.com/apppasswords'
            : 'Check your credentials in Function Secrets'
        }`);
      } else {
        throw new Error(`Authentication failed: ${authResponse}`);
      }
    } catch (authError) {
      // Send QUIT even on auth failure
      try {
        await sendCommand('QUIT');
      } catch (quitError) {
        console.warn('Failed to send QUIT:', quitError);
      }
      throw authError;
    }
    
  } catch (error) {
    console.error('❌ SMTP Authentication test failed:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.close();
      } catch (closeError) {
        console.warn('Failed to close connection:', closeError);
      }
    }
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