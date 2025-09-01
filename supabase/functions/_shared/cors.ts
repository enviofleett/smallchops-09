// ============================================
// CORS CONFIGURATION WITH ORIGIN ALLOWLIST
// Centralized CORS handling for all edge functions
// ============================================

// Production domains that should be allowed
const ALLOWED_ORIGINS = [
  'https://startersmallchops.com',
  'https://www.startersmallchops.com', 
  'https://startersmallchops.lovableproject.com',
  'https://startersmallchops.lovable.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  // Add any additional domains as needed
];

// Paystack domains for payment callbacks
const PAYSTACK_DOMAINS = [
  'https://checkout.paystack.com',
  'https://js.paystack.co',
  'https://api.paystack.co'
];

// Development patterns
const DEV_PATTERNS = [
  /^http:\/\/localhost:\d+$/,
  /^https:\/\/.*\.lovable\.app$/,
  /^https:\/\/.*\.lovableproject\.com$/,
  /^https:\/\/.*\.supabase\.co$/,
  /^https:\/\/.*\.sandbox\.lovable\.dev$/  // Added sandbox domains
];

export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const baseHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 
      'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Max-Age': '3600', // Reduced from 24h to 1h
    'Access-Control-Allow-Credentials': 'false'
  };

  // If no origin specified, reject with null (more secure)
  if (!origin) {
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': 'null'
    };
  }

  // Check if origin is explicitly allowed
  if (ALLOWED_ORIGINS.includes(origin) || PAYSTACK_DOMAINS.includes(origin)) {
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin'
    };
  }

  // Check against development patterns (only in non-production)
  const isProduction = Deno.env.get('ENVIRONMENT') === 'production';
  if (!isProduction) {
    const isDevOrigin = DEV_PATTERNS.some(pattern => pattern.test(origin));
    if (isDevOrigin) {
      return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin'
      };
    }
  }

  // Log rejected origins without exposing sensitive info
  console.log('🚫 CORS: Origin not allowed');
  
  // Return restrictive headers for unknown origins
  return {
    ...baseHeaders,
    'Access-Control-Allow-Origin': 'null'
  };
}

export function validateOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  
  return ALLOWED_ORIGINS.includes(origin) || 
         PAYSTACK_DOMAINS.includes(origin) ||
         DEV_PATTERNS.some(pattern => pattern.test(origin));
}