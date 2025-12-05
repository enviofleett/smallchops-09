import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

// Production-ready CORS configuration with wildcard support
const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.supabase.co',
    'https://lovable.dev',
    'https://startersmallchops.com',
    'https://www.startersmallchops.com',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovableproject.com',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovable.dev',
    'https://id-preview--7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovable.app',
    'https://project-oknnklksdiqaifhxaccs.lovable.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8000'
  ];
  
  // Check for exact match first
  if (origin && allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };
  }
  
  // Check for wildcard patterns (subdomains of startersmallchops.com and lovable domains)
  if (origin) {
    const wildcardPatterns = [
      /^https:\/\/.*\.startersmallchops\.com$/,
      /^https:\/\/.*\.lovable\.dev$/,
      /^https:\/\/.*\.lovable\.app$/,
      /^https:\/\/.*\.lovableproject\.com$/,
      /^https:\/\/.*\.supabase\.co$/
    ];
    
    if (wildcardPatterns.some(pattern => pattern.test(origin))) {
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
      };
    }
  }
  
  // Fallback for development or unknown origins
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

interface ProductImageUploadRequest {
  file: {
    name: string;
    type: string;
    size: number;
    data: string; // base64 encoded
  };
}

// Rate limit configuration - increased for production use
const RATE_LIMIT_MAX_UPLOADS = 100; // Increased from 10 to 100 per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log('Product image upload request:', req.method, req.url, 'from origin:', origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    console.log('Admin access confirmed');

    // Check rate limiting using direct database query
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    
    const { data: recentUploads, error: rateLimitError } = await supabase
      .from('audit_logs')
      .select('id, created_at')
      .eq('action', 'product_image_upload')
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: true });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit check failed'
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const uploadCount = recentUploads?.length || 0;
    const remainingUploads = RATE_LIMIT_MAX_UPLOADS - uploadCount;
    
    // Calculate time until oldest upload expires (for reset time)
    let resetTimeSeconds = 3600;
    if (recentUploads && recentUploads.length > 0) {
      const oldestUpload = new Date(recentUploads[0].created_at);
      const resetTime = new Date(oldestUpload.getTime() + RATE_LIMIT_WINDOW_MS);
      resetTimeSeconds = Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
    }
    
    if (uploadCount >= RATE_LIMIT_MAX_UPLOADS) {
      const minutesUntilReset = Math.ceil(resetTimeSeconds / 60);
      console.log(`Rate limit exceeded for user ${user.id}: ${uploadCount}/${RATE_LIMIT_MAX_UPLOADS} uploads in last hour`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Rate limit exceeded. You've uploaded ${uploadCount} images in the last hour. Please wait ${minutesUntilReset} minutes before uploading more.`,
          rate_limit: {
            current: uploadCount,
            limit: RATE_LIMIT_MAX_UPLOADS,
            remaining: 0,
            reset_in_seconds: resetTimeSeconds,
            reset_in_minutes: minutesUntilReset
          }
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(resetTimeSeconds),
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX_UPLOADS),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(resetTimeSeconds)
          }
        }
      );
    }

    console.log(`Rate limit check passed: ${uploadCount}/${RATE_LIMIT_MAX_UPLOADS} uploads used (${remainingUploads} remaining)`);

    if (req.method === 'POST') {
      const body: ProductImageUploadRequest = await req.json();
      
      if (!body.file) {
        throw new Error('No file provided');
      }

      const { file } = body;

      // Validate file
      console.log('Validating file:', file.name, file.type, file.size);

      // Check file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      }

      // Check file size (10MB limit for original, but Base64 will be ~33% larger)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Validate file name
      if (!file.name || file.name.length > 255) {
        throw new Error('Invalid file name');
      }

      // Decode base64 file data
      const fileBuffer = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = crypto.randomUUID().slice(0, 8);
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `product-${timestamp}-${randomId}.${fileExtension}`;

      console.log('Uploading file to storage:', fileName);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('products-images')
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      console.log('File uploaded successfully:', uploadData.path);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('products-images')
        .getPublicUrl(uploadData.path);

      console.log('Public URL generated:', publicUrl);

      // Log the upload in audit logs
      await supabase.from('audit_logs').insert({
        action: 'product_image_upload',
        category: 'Product Management',
        message: 'Product image uploaded successfully',
        user_id: user.id,
        new_values: {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          public_url: publicUrl
        }
      });

      console.log('Product image upload completed successfully');

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            url: publicUrl,
            fileName: uploadData.path,
            fileSize: file.size,
            fileType: file.type
          },
          rate_limit: {
            current: uploadCount + 1,
            limit: RATE_LIMIT_MAX_UPLOADS,
            remaining: remainingUploads - 1
          }
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX_UPLOADS),
            'X-RateLimit-Remaining': String(remainingUploads - 1)
          }
        }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Method not allowed' 
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Product image upload error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        status: error.message?.includes('Unauthorized') || error.message?.includes('Admin access') ? 403 : 
               error.message?.includes('Rate limit') ? 429 : 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
