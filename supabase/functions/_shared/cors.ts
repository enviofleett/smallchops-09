// Shared CORS utilities for Supabase Edge Functions
// Environment-aware CORS configuration for production security

export function getAllowedOrigins(): string[] {
  const envType = Deno.env.get('DENO_ENV') || 'development';
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS') || '*';
  
  if (envType === 'production') {
    return allowedOrigins.split(',').map(origin => origin.trim().toLowerCase());
  }
  
  return ['*']; // Allow all in development
}

export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  
  // Check if origin is allowed
  let allowOrigin = '*';
  
  if (origin && !allowedOrigins.includes('*')) {
    const normalizedOrigin = origin.toLowerCase();
    if (allowedOrigins.includes(normalizedOrigin)) {
      allowOrigin = origin; // Use original case
    } else {
      allowOrigin = allowedOrigins[0] || '*';
    }
  }
    
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

export function validateOrigin(origin: string | null): boolean {
  if (!origin) return true; // Allow requests without origin (like server-to-server)
  
  const allowedOrigins = getAllowedOrigins();
  
  if (allowedOrigins.includes('*')) {
    return true;
  }
  
  return allowedOrigins.includes(origin.toLowerCase());
}