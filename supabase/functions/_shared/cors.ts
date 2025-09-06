// ============================================
// CORS CONFIGURATION WITH ORIGIN ALLOWLIST
// Centralized CORS handling for all edge functions
// ============================================

// Get environment variables with sensible defaults
const ENV_NAME = Deno.env.get('DENO_ENV') || Deno.env.get('ENVIRONMENT') || 'development';
const ALLOWED_ORIGINS_ENV = Deno.env.get('ALLOWED_ORIGINS') || '';

console.log(`🌍 CORS: Environment=${ENV_NAME}, Custom origins=${ALLOWED_ORIGINS_ENV}`);

// Parse additional origins from environment
const CUSTOM_ORIGINS = ALLOWED_ORIGINS_ENV
  .split(',')
  .map(origin => origin.trim())
  .filter(origin => origin.length > 0);

// Base production domains
const BASE_ALLOWED_ORIGINS = [
  'https://startersmallchops.com',
  'https://www.startersmallchops.com', 
  'https://startersmallchops.lovableproject.com',
  'https://startersmallchops.lovable.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
];

// Merge with custom origins from environment
const ALLOWED_ORIGINS = [...BASE_ALLOWED_ORIGINS, ...CUSTOM_ORIGINS];

// Paystack domains for payment callbacks
const PAYSTACK_DOMAINS = [
  'https://checkout.paystack.com',
  'https://js.paystack.co',
  'https://api.paystack.co'
];

// Development patterns (always allowed in non-production)
const DEV_PATTERNS = [
  /^http:\/\/localhost:\d+$/,
  /^https:\/\/.*\.lovable\.app$/,
  /^https:\/\/.*\.lovableproject\.com$/,
  /^https:\/\/.*\.supabase\.co$/,
  /^https:\/\/.*\.sandbox\.lovable\.dev$/,
  /^https:\/\/id-preview--.*\.lovable\.app$/,
  /^https:\/\/.*-.*-.*-.*-.*\.sandbox\.lovable\.dev$/
];

export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const baseHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 
      'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Max-Age': '3600',
    'Access-Control-Allow-Credentials': 'false'
  };

  console.log(`🔍 CORS: Checking origin="${origin}" in env="${ENV_NAME}"`);

  // If no origin specified, reject with null (more secure)
  if (!origin) {
    console.log('⚠️ CORS: No origin provided, returning null');
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': 'null'
    };
  }

  // Check if origin is explicitly allowed
  if (ALLOWED_ORIGINS.includes(origin) || PAYSTACK_DOMAINS.includes(origin)) {
    console.log(`✅ CORS: Origin "${origin}" explicitly allowed`);
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin'
    };
  }

  // Check against development patterns (only in non-production)
  const isProduction = ENV_NAME === 'production';
  if (!isProduction) {
    const isDevOrigin = DEV_PATTERNS.some(pattern => pattern.test(origin));
    if (isDevOrigin) {
      console.log(`✅ CORS: Origin "${origin}" matched dev pattern in ${ENV_NAME} mode`);
      return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin'
      };
    }
  }

  // Log rejected origins for debugging
  console.log(`🚫 CORS: Origin "${origin}" rejected in ${ENV_NAME} mode`);
  
  // Return restrictive headers for unknown origins
  return {
    ...baseHeaders,
    'Access-Control-Allow-Origin': 'null',
    'Vary': 'Origin'
  };
}

export function handleCorsPreflightResponse(origin?: string | null): Response {
  const headers = getCorsHeaders(origin);
  console.log(`🔄 CORS: Preflight response for origin="${origin}"`);
  return new Response(null, { 
    status: 204,
    headers 
  });
}

export function validateOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  
  return ALLOWED_ORIGINS.includes(origin) || 
         PAYSTACK_DOMAINS.includes(origin) ||
         DEV_PATTERNS.some(pattern => pattern.test(origin));
}