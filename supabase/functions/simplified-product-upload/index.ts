import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

// Simple CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ProductImageUploadRequest {
  file: {
    name: string;
    type: string;
    size: number;
    data: string; // base64 encoded
  };
}

Deno.serve(async (req) => {
  console.log('Simplified product image upload request:', req.method, req.url);

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
      throw new Error('Authentication required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    console.log('User authenticated:', user.id);

    if (req.method === 'POST') {
      const body: ProductImageUploadRequest = await req.json();
      
      if (!body.file) {
        throw new Error('No file provided');
      }

      const { file } = body;

      // Basic validation only
      console.log('Processing file:', file.name, file.type, `${(file.size / 1024 / 1024).toFixed(2)}MB`);

      // Check file type (allow all common image types)
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}. Please use PNG, JPG, WebP, GIF, or SVG.`);
      }

      // Check file size (20MB limit)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (file.size > maxSize) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        throw new Error(`File size (${sizeMB}MB) exceeds 20MB limit. Please compress your image.`);
      }

      // Decode base64 file data
      const fileBuffer = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = crypto.randomUUID().slice(0, 8);
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `product-${timestamp}-${randomId}.${fileExtension}`;

      console.log('Uploading to products-images bucket:', fileName);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('products-images')
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('File uploaded successfully:', uploadData.path);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('products-images')
        .getPublicUrl(uploadData.path);

      console.log('Public URL generated:', publicUrl);

      // Log the upload (optional - no blocking)
      try {
        await supabase.from('audit_logs').insert({
          action: 'product_image_upload_simplified',
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
      } catch (logError) {
        console.warn('Failed to log upload (non-blocking):', logError);
      }

      console.log('Product image upload completed successfully');

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            url: publicUrl,
            fileName: uploadData.path,
            fileSize: file.size,
            fileType: file.type
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
    console.error('Product image upload error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Upload failed'
      }),
      {
        status: error.message?.includes('Authentication') ? 401 : 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});