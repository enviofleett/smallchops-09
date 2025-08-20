
// PATCH: robust CORS with explicit allowlist and wider headers

const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "content-type",
  "x-requested-with",          // PATCH: added for fetch/XHR compat
  "x-client-version",
  "x-supabase-api-version",
  "x-forwarded-for",
  "accept",
  "accept-language",
  "origin",
  "referer",
].join(", ");

const DEFAULT_ALLOWED_METHODS = "GET,POST,OPTIONS";

const parseAllowedOrigins = () => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
};

export const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const allowlist = parseAllowedOrigins();
  const allowOrigin = allowlist.includes(origin) ? origin : "";

  return {
    "Access-Control-Allow-Origin": allowOrigin, // empty -> browser blocks unknowns
    "Vary": "Origin",
    "Access-Control-Allow-Methods": DEFAULT_ALLOWED_METHODS,
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Credentials": "true",
  };
};

export const handleCorsPreflight = (req: Request) => {
  if (req.method.toUpperCase() !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: getCorsHeaders(req) });
};

// Legacy support for existing functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
