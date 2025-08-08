// Production-ready CORS configuration
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Define allowed origins for production
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.supabase.co', // Default Supabase hosting
    'https://oknnklksdiqaifhxaccs.lovable.app', // Lovable staging
    'https://startersmallchops.com', // Production domain
    'https://www.startersmallchops.com', // Production www domain
    'https://preview--smallchops-09.lovable.app', // Lovable preview domain
    'http://localhost:3000', // Local development
    'http://localhost:5173', // Vite dev server
    'https://localhost:3000', // Local HTTPS
    'https://localhost:5173'  // Vite HTTPS
  ];

  // Add custom domain if configured
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    allowedOrigins.push(`https://${customDomain}`);
    allowedOrigins.push(`https://www.${customDomain}`);
  }

  const isDev = Deno.env.get('DENO_ENV') === 'development';
  const isAllowed = origin && allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (isDev ? '*' : allowedOrigins[0]),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };
}

export const corsHeaders = getCorsHeaders(null);