
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, if-none-match',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body for POST requests or URL params for GET
    let categoryId, page, limit, search;
    
    if (req.method === 'POST') {
      const body = await req.json();
      categoryId = body.category_id;
      page = parseInt(body.page || '1');
      limit = Math.min(parseInt(body.limit || '20'), 50);
      search = body.q;
    } else {
      const url = new URL(req.url);
      categoryId = url.searchParams.get('category_id');
      page = parseInt(url.searchParams.get('page') || '1');
      limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
      search = url.searchParams.get('q');
    }
    
    const offset = (page - 1) * limit;

    // Build cache key for ETag
    const cacheKey = `products-${categoryId || 'all'}-${page}-${limit}-${search || ''}`
    const requestETag = req.headers.get('if-none-match')

    console.log(`[get-public-products] Request: category=${categoryId}, page=${page}, limit=${limit}, search=${search}`)

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('status', 'active')

    // Apply filters
    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', categoryId)
    }

    if (search) {
      // Use trigram search for better performance
      query = query.or(`name.ilike.%${search}%, description.ilike.%${search}%, sku.ilike.%${search}%`)
    }

    // Apply pagination and ordering
    query = query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data: products, error, count } = await query

    if (error) {
      console.error('[get-public-products] Database error:', error)
      throw error
    }

    console.log(`[get-public-products] Found ${products?.length || 0} products, total: ${count}`)

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    const response = {
      products: products || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      timestamp: new Date().toISOString()
    }

    // Generate ETag based on data
    const dataHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(response))
    )
    const etag = Array.from(new Uint8Array(dataHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16)

    // Check if client has cached version
    if (requestETag === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'ETag': etag,
        }
      })
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5min cache, 10min stale
        'ETag': etag,
      },
    })

  } catch (error) {
    console.error('[get-public-products] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch products', details: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
