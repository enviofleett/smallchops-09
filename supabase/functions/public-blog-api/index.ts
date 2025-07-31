import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const url = new URL(req.url);
    const path = url.pathname;
    const searchParams = url.searchParams;

    console.log(`Blog API request: ${req.method} ${path}`);

    // Get blog categories
    if (path === '/categories') {
      const { data, error } = await supabaseClient
        .from('blog_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.error('Categories error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get blog articles
    if (path === '/articles') {
      let query = supabaseClient
        .from('blog_articles')
        .select(`
          *,
          blog_categories (
            id,
            name,
            slug
          )
        `)
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      // Filter by category if specified
      const categoryId = searchParams.get('category_id');
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      // Pagination
      const limit = parseInt(searchParams.get('limit') || '10');
      const offset = parseInt(searchParams.get('offset') || '0');
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        console.error('Articles error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get single article by slug
    if (path.startsWith('/articles/')) {
      const slug = path.split('/articles/')[1];
      
      const { data, error } = await supabaseClient
        .from('blog_articles')
        .select(`
          *,
          blog_categories (
            id,
            name,
            slug
          )
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (error) {
        console.error('Article error:', error);
        return new Response(JSON.stringify({ error: 'Article not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Increment view count
      await supabaseClient
        .from('blog_articles')
        .update({ view_count: data.view_count + 1 })
        .eq('id', data.id);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // API documentation
    if (path === '/' || path === '/docs') {
      const docs = {
        name: 'Blog API',
        version: '1.0.0',
        description: 'Public API for blog content',
        endpoints: {
          '/categories': {
            method: 'GET',
            description: 'Get all active blog categories',
            parameters: {},
          },
          '/articles': {
            method: 'GET',
            description: 'Get published blog articles',
            parameters: {
              category_id: 'Filter by category ID',
              limit: 'Number of articles to return (default: 10)',
              offset: 'Number of articles to skip (default: 0)',
            },
          },
          '/articles/{slug}': {
            method: 'GET',
            description: 'Get a specific article by slug',
            parameters: {
              slug: 'Article slug identifier',
            },
          },
        },
      };

      return new Response(JSON.stringify(docs, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});