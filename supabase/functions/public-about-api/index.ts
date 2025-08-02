import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Remove 'about' from path segments if it exists (for cleaner API paths)
    if (pathSegments[0] === 'about') {
      pathSegments.shift();
    }

    const endpoint = pathSegments[0] || 'complete';

    switch (endpoint) {
      case 'hero': {
        const { data, error } = await supabaseClient
          .from('about_us_sections')
          .select('*')
          .eq('section_type', 'hero')
          .eq('is_published', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          data: data || null 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'story': {
        const { data, error } = await supabaseClient
          .from('about_us_sections')
          .select('*')
          .eq('section_type', 'story')
          .eq('is_published', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          data: data || null 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'values': {
        const { data, error } = await supabaseClient
          .from('about_us_sections')
          .select('*')
          .eq('section_type', 'values')
          .eq('is_published', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          data: data || null 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'team': {
        // Get team intro section
        const { data: teamIntro, error: introError } = await supabaseClient
          .from('about_us_sections')
          .select('*')
          .eq('section_type', 'team_intro')
          .eq('is_published', true)
          .single();

        if (introError && introError.code !== 'PGRST116') {
          console.error('Error fetching team intro:', introError);
        }

        // Get team members
        const { data: teamMembers, error: membersError } = await supabaseClient
          .from('team_members')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (membersError) {
          throw membersError;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          data: {
            intro: teamIntro || null,
            members: teamMembers || []
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'gallery': {
        const url = new URL(req.url);
        const category = url.searchParams.get('category');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = supabaseClient
          .from('about_us_gallery')
          .select('*')
          .eq('is_published', true)
          .order('sort_order')
          .range(offset, offset + limit - 1);

        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          data: data || [],
          pagination: {
            limit,
            offset,
            count: data?.length || 0
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'contact': {
        const { data, error } = await supabaseClient
          .from('about_us_sections')
          .select('*')
          .eq('section_type', 'contact')
          .eq('is_published', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          data: data || null 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'complete': {
        // Get all published sections
        const { data: sections, error: sectionsError } = await supabaseClient
          .from('about_us_sections')
          .select('*')
          .eq('is_published', true)
          .order('sort_order');

        if (sectionsError) {
          throw sectionsError;
        }

        // Get active team members
        const { data: teamMembers, error: membersError } = await supabaseClient
          .from('team_members')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (membersError) {
          throw membersError;
        }

        // Get published gallery items
        const { data: gallery, error: galleryError } = await supabaseClient
          .from('about_us_gallery')
          .select('*')
          .eq('is_published', true)
          .order('sort_order')
          .limit(12); // Limit to first 12 for complete view

        if (galleryError) {
          throw galleryError;
        }

        // Organize sections by type
        const organizedSections: { [key: string]: any } = {};
        sections?.forEach(section => {
          organizedSections[section.section_type] = section;
        });

        return new Response(JSON.stringify({ 
          success: true, 
          data: {
            sections: organizedSections,
            team: {
              intro: organizedSections.team_intro || null,
              members: teamMembers || []
            },
            gallery: gallery || []
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'docs':
      case '': {
        const apiDocumentation = {
          title: "About Us API Documentation",
          version: "1.0.0",
          description: "Public API for accessing About Us page content",
          baseUrl: `${url.origin}/functions/v1/public-about-api/`,
          endpoints: {
            "GET /hero": {
              description: "Get hero section content",
              response: {
                success: true,
                data: {
                  id: "uuid",
                  section_type: "hero",
                  title: "Page title",
                  content: "HTML content",
                  image_url: "Image URL",
                  seo_title: "SEO title",
                  seo_description: "SEO description"
                }
              }
            },
            "GET /story": {
              description: "Get company story content",
              response: "Same structure as hero section"
            },
            "GET /values": {
              description: "Get company values/why choose us content",
              response: "Same structure as hero section"
            },
            "GET /team": {
              description: "Get team information including intro and members",
              response: {
                success: true,
                data: {
                  intro: "Team intro section object",
                  members: [
                    {
                      id: "uuid",
                      name: "Team member name",
                      position: "Job title",
                      bio: "Biography",
                      image_url: "Profile photo URL",
                      email: "Email address",
                      phone: "Phone number",
                      linkedin_url: "LinkedIn profile URL"
                    }
                  ]
                }
              }
            },
            "GET /gallery": {
              description: "Get gallery images with optional filtering",
              queryParameters: {
                category: "Filter by category (office, team, events, products, general)",
                limit: "Number of items to return (default: 20)",
                offset: "Number of items to skip (default: 0)"
              },
              response: {
                success: true,
                data: [
                  {
                    id: "uuid",
                    title: "Image title",
                    description: "Image description",
                    image_url: "Image URL",
                    alt_text: "Alt text for accessibility",
                    category: "Image category"
                  }
                ],
                pagination: {
                  limit: 20,
                  offset: 0,
                  count: "Number of items returned"
                }
              }
            },
            "GET /contact": {
              description: "Get contact section content",
              response: "Same structure as hero section"
            },
            "GET /complete": {
              description: "Get all about us content in a single response",
              response: {
                success: true,
                data: {
                  sections: "Object with all sections keyed by section_type",
                  team: "Complete team data",
                  gallery: "First 12 gallery items"
                }
              }
            }
          },
          usage: {
            "Frontend Integration": "Use these endpoints to populate your About Us page",
            "Image Handling": "All image URLs are served from Supabase Storage",
            "Content Formatting": "Content may contain HTML markup",
            "Caching": "Responses can be cached for better performance"
          }
        };

        return new Response(JSON.stringify(apiDocumentation, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Endpoint not found',
          message: `Available endpoints: /hero, /story, /values, /team, /gallery, /contact, /complete, /docs`
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('About API Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})