import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// SMTP Authentication Health Check
// Performs a lightweight SMTP connection and auth test without sending emails
serve(async (req) => {
  console.log(`🔍 SMTP Auth Health Check - ${req.method} request received`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get production SMTP configuration
    const smtpConfig = await getProductionSMTPConfig(supabase);
    
    console.log(`🔍 Testing SMTP auth for ${smtpConfig.host}:${smtpConfig.port}`);
    
    // Perform lightweight SMTP connection test
    const authResult = await testSMTPAuth(smtpConfig);
    
    // Record health metric
    await recordHealthMetric(supabase, authResult);
    
    const responseData = {
      success: authResult.success,
      timestamp: new Date().toISOString(),
      provider: {
        host: smtpConfig.host,
        port: smtpConfig.port,
        username: smtpConfig.username?.split('@')[0] + '@***',
        source: smtpConfig.source
      },
      auth: {
        method: authResult.authMethod,
        tlsMode: authResult.tlsMode,
        capabilities: authResult.capabilities
      },
      timing: {
        connectionMs: authResult.connectionTime,
        authMs: authResult.authTime,
        totalMs: authResult.totalTime
      },
      ...(authResult.error && { 
        error: authResult.error,
        category: authResult.errorCategory,
        suggestion: authResult.suggestion 
      })
    };

    // Always return 200 to allow UI to parse detailed error information
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ SMTP Auth Health Check failed:', error);
    
    // Always return 200 with error details for UI parsing
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      category: 'system_error',
      suggestion: 'Check SMTP configuration and credentials',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});

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
  // Priority 1: Function Secrets (Production)
  const secretHost = Deno.env.get('SMTP_HOST');
  const secretPort = Deno.env.get('SMTP_PORT');
  const secretUsername = Deno.env.get('SMTP_USERNAME');
  const secretPassword = Deno.env.get('SMTP_PASSWORD');
  const secretEncryption = Deno.env.get('SMTP_ENCRYPTION');
  const secretFromName = Deno.env.get('SMTP_FROM_NAME');
  const secretFromEmail = Deno.env.get('SMTP_FROM_EMAIL');

  if (secretHost && secretUsername && secretPassword) {
    return {
      host: secretHost.trim(),
      port: parseInt(secretPort || '587'),
      username: secretUsername.trim(),
      password: secretPassword.trim(),
      senderEmail: (secretFromEmail || secretUsername).trim(),
      senderName: (secretFromName || 'Starters Small Chops').trim(),
      encryption: secretEncryption?.trim() || 'TLS',
      source: 'function_secrets'
    };
  }

  // Priority 2: Database fallback
  const { data: config } = await supabase
    .from('communication_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!config?.use_smtp || !config.smtp_host || !config.smtp_user || !config.smtp_pass) {
    throw new Error('SMTP not configured properly');
  }

  return {
    host: config.smtp_host.trim(),
    port: config.smtp_port || 587,
    username: config.smtp_user.trim(),
    password: config.smtp_pass.trim(),
    senderEmail: (config.sender_email || config.smtp_user).trim(),
    senderName: (config.sender_name || 'Starters Small Chops').trim(),
    encryption: 'TLS',
    source: 'database'
  };
}

// Lightweight SMTP authentication test
async function testSMTPAuth(config: any): Promise<{
  success: boolean;
  authMethod?: string;
  tlsMode?: string;
  capabilities?: string[];
  connectionTime?: number;
  authTime?: number;
  totalTime?: number;
  error?: string;
  errorCategory?: string;
  suggestion?: string;
}> {
  const startTime = Date.now();
  let conn: Deno.TcpConn | Deno.TlsConn | null = null;
  
  try {
    // 1. TCP Connection
    const connectStart = Date.now();
    conn = await Promise.race([
      Deno.connect({ hostname: config.host, port: config.port }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
    ]);
    const connectionTime = Date.now() - connectStart;

    // 2. Read greeting
    await readSMTPResponse(conn);

    // 3. Send EHLO
    await sendSMTPCommand(conn, `EHLO ${config.host}`);
    const ehloResponse = await readSMTPResponse(conn);
    
    // Parse capabilities
    const capabilities: string[] = [];
    const authMethods: string[] = [];
    
    for (const line of ehloResponse.split('\r\n')) {
      if (line.startsWith('250-') || line.startsWith('250 ')) {
        const capability = line.substring(4).trim();
        capabilities.push(capability.split(' ')[0]);
        
        if (capability.startsWith('AUTH ')) {
          authMethods.push(...capability.substring(5).split(/\s+/));
        }
      }
    }

    let tlsMode = 'none';
    
    // 4. Handle TLS if needed
    if (config.port === 587 && capabilities.includes('STARTTLS')) {
      await sendSMTPCommand(conn, 'STARTTLS');
      await readSMTPResponse(conn);
      
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: config.host });
      tlsMode = 'starttls';
      
      // Re-negotiate after TLS
      await sendSMTPCommand(conn, `EHLO ${config.host}`);
      await readSMTPResponse(conn);
    } else if (config.port === 465) {
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: config.host });
      tlsMode = 'implicit';
    }

    // 5. Test authentication
    const authStart = Date.now();
    let authMethod = 'LOGIN'; // Default fallback
    
    if (authMethods.includes('PLAIN')) {
      authMethod = 'PLAIN';
      const authString = `\0${config.username}\0${config.password}`;
      const encoded = btoa(authString);
      await sendSMTPCommand(conn, `AUTH PLAIN ${encoded}`);
    } else {
      // Fallback to LOGIN
      await sendSMTPCommand(conn, 'AUTH LOGIN');
      await readSMTPResponse(conn); // 334 response
      
      await sendSMTPCommand(conn, btoa(config.username));
      await readSMTPResponse(conn); // 334 response
      
      await sendSMTPCommand(conn, btoa(config.password));
    }
    
    const authResponse = await readSMTPResponse(conn);
    const authTime = Date.now() - authStart;
    
    if (!authResponse.startsWith('235')) {
      throw new Error(`Authentication failed: ${authResponse}`);
    }

    // 6. Clean disconnect
    await sendSMTPCommand(conn, 'QUIT');
    await readSMTPResponse(conn);
    conn.close();

    const totalTime = Date.now() - startTime;

    return {
      success: true,
      authMethod,
      tlsMode,
      capabilities,
      connectionTime,
      authTime,
      totalTime
    };

  } catch (error) {
    if (conn) {
      try { conn.close(); } catch {}
    }
    
    const errorMessage = error.message.toLowerCase();
    let category = 'unknown';
    let suggestion = 'Check SMTP server configuration';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      category = 'connection';
      suggestion = 'Check network connectivity and SMTP server availability';
    } else if (errorMessage.includes('535') || errorMessage.includes('authentication')) {
      category = 'auth';
      suggestion = 'Verify SMTP username and password credentials';
    } else if (errorMessage.includes('tls') || errorMessage.includes('starttls')) {
      category = 'tls';
      suggestion = 'Check TLS/SSL configuration and port settings';
    }

    return {
      success: false,
      error: error.message,
      errorCategory: category,
      suggestion,
      totalTime: Date.now() - startTime
    };
  }
}

// Helper functions for SMTP communication
async function sendSMTPCommand(conn: Deno.TcpConn | Deno.TlsConn, command: string): Promise<void> {
  const data = command.endsWith('\r\n') ? command : command + '\r\n';
  await conn.write(new TextEncoder().encode(data));
}

async function readSMTPResponse(conn: Deno.TcpConn | Deno.TlsConn): Promise<string> {
  let response = '';
  const buffer = new Uint8Array(1024);
  
  while (true) {
    const n = await conn.read(buffer);
    if (n === null) throw new Error('Connection closed');
    
    const chunk = new TextDecoder().decode(buffer.subarray(0, n));
    response += chunk;
    
    // Check for complete response
    const lines = response.split('\r\n');
    const lastLine = lines[lines.length - 2]; // Skip empty last line
    
    if (lastLine && /^\d{3}\s/.test(lastLine)) {
      break; // Final response line
    }
  }
  
  return response.trim();
}

// Record health metrics for monitoring
async function recordHealthMetric(supabase: any, result: any): Promise<void> {
  try {
    await supabase.from('smtp_health_metrics').insert({
      provider_name: 'yournotify-production',
      metric_type: 'auth_test',
      metric_value: result.success ? 1 : 0,
      threshold_value: null,
      threshold_breached: !result.success,
      recorded_at: new Date().toISOString(),
      metadata: {
        config_source: result.configSource || 'unknown',
        auth_method: result.authMethod,
        tls_mode: result.tlsMode,
        connection_time_ms: result.connectionTime,
        auth_time_ms: result.authTime,
        total_time_ms: result.totalTime,
        error_category: result.errorCategory,
        capabilities: result.capabilities
      }
    });
  } catch (error) {
    console.warn('Failed to record health metric:', error.message);
  }
}