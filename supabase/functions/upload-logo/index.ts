import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

// Production-ready CORS configuration
const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.supabase.co',
    'https://lovable.dev',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovableproject.com',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovable.dev',
    'https://id-preview--7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovable.app',
    'https://project-oknnklksdiqaifhxaccs.lovable.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8000'
  ];
  
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : '*';
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

interface LogoUploadRequest {
  file: {
    name: string;
    type: string;
    size: number;
    data: string; // base64 encoded
  };
  alt_text?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log('Logo upload request:', req.method, req.url, 'from origin:', origin);

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

    // Check rate limiting
    const { data: rateLimitCheck, error: rateLimitError } = await supabase
      .rpc('check_upload_rate_limit', { p_user_id: user.id });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      throw new Error('Rate limit check failed');
    }

    if (!rateLimitCheck) {
      throw new Error('Rate limit exceeded. Maximum 10 uploads per hour.');
    }

    console.log('Rate limit check passed');

    if (req.method === 'POST') {
      const body: LogoUploadRequest = await req.json();
      
      if (!body.file) {
        throw new Error('No file provided');
      }

      const { file, alt_text } = body;

      // Validate file
      console.log('Validating file:', file.name, file.type, file.size);

      // Check file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      }

      // Check file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File size exceeds 5MB limit');
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
      const fileExtension = file.name.split('.').pop() || 'png';
      const fileName = `logo-${timestamp}-${randomId}.${fileExtension}`;

      console.log('Uploading file to storage:', fileName);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('business-logos')
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
        .from('business-logos')
        .getPublicUrl(uploadData.path);

      console.log('Public URL generated:', publicUrl);

      // Get image dimensions (for certain formats)
      let dimensions = null;
      try {
        if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
          // For now, we'll store basic info and let the frontend handle dimensions
          dimensions = { 
            note: 'Dimensions can be extracted on frontend if needed',
            fileSize: file.size,
            fileType: file.type
          };
        }
      } catch (e) {
        console.log('Could not extract dimensions:', e);
      }

      // Create logo version record
      const { data: versionId, error: versionError } = await supabase
        .rpc('create_logo_version', {
          p_logo_url: publicUrl,
          p_file_size: file.size,
          p_file_type: file.type,
          p_dimensions: dimensions,
          p_uploaded_by: user.id
        });

      if (versionError) {
        console.error('Version creation error:', versionError);
        // Continue anyway, this is not critical
      }

      // Log the upload
      await supabase.rpc('log_branding_change', {
        p_action: 'logo_upload',
        p_field_name: 'logo_url',
        p_old_value: null,
        p_new_value: publicUrl,
        p_metadata: {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          alt_text: alt_text || null,
          version_id: versionId
        }
      });

      console.log('Logo upload completed successfully');

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            url: publicUrl,
            fileName: uploadData.path,
            fileSize: file.size,
            fileType: file.type,
            altText: alt_text,
            versionId: versionId
          }
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
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
    console.error('Logo upload error:', error);
    
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