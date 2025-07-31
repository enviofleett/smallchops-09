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

interface LogoValidationRequest {
  file: {
    name: string;
    type: string;
    size: number;
    data?: string; // base64 encoded - optional for basic validation
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  score: number; // 0-100
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log('Logo validation request:', req.method, req.url, 'from origin:', origin);

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

    // Get user from auth header (optional for validation)
    const authHeader = req.headers.get('Authorization');
    let user = null;
    
    if (authHeader) {
      const { data: { user: authUser } } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      user = authUser;
    }

    if (req.method === 'POST') {
      const body: LogoValidationRequest = await req.json();
      
      if (!body.file) {
        throw new Error('No file provided');
      }

      const { file } = body;
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        recommendations: [],
        score: 100
      };

      console.log('Validating file:', file.name, file.type, file.size);

      // 1. File Type Validation
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        result.errors.push(`Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`);
        result.isValid = false;
        result.score -= 30;
      }

      // 2. File Size Validation
      const maxSize = 5 * 1024 * 1024; // 5MB
      const idealMaxSize = 1 * 1024 * 1024; // 1MB ideal
      
      if (file.size > maxSize) {
        result.errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of 5MB`);
        result.isValid = false;
        result.score -= 40;
      } else if (file.size > idealMaxSize) {
        result.warnings.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) is larger than recommended 1MB`);
        result.score -= 10;
      }

      // 3. File Name Validation
      if (!file.name || file.name.length === 0) {
        result.errors.push('File name is required');
        result.isValid = false;
        result.score -= 20;
      } else if (file.name.length > 255) {
        result.errors.push('File name is too long (maximum 255 characters)');
        result.isValid = false;
        result.score -= 15;
      }

      // Check for suspicious characters in filename
      const suspiciousPattern = /[<>:"|?*\x00-\x1f]/;
      if (suspiciousPattern.test(file.name)) {
        result.errors.push('File name contains invalid characters');
        result.isValid = false;
        result.score -= 25;
      }

      // 4. File Extension Validation
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
      
      if (!fileExtension || !validExtensions.includes(fileExtension)) {
        result.warnings.push(`Unusual file extension: ${fileExtension}. Recommended: png, jpg, svg`);
        result.score -= 5;
      }

      // 5. Advanced File Content Validation (if data provided)
      if (file.data) {
        try {
          // Basic base64 validation
          const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
          if (!base64Pattern.test(file.data)) {
            result.errors.push('Invalid file data format');
            result.isValid = false;
            result.score -= 30;
          } else {
            // Check file header/magic numbers
            const fileBuffer = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
            const isValidFileHeader = validateFileHeader(fileBuffer, file.type);
            
            if (!isValidFileHeader) {
              result.errors.push('File content does not match declared file type');
              result.isValid = false;
              result.score -= 35;
            }
          }
        } catch (e) {
          result.errors.push('Unable to process file data');
          result.isValid = false;
          result.score -= 25;
        }
      }

      // 6. Recommendations
      if (file.type === 'image/svg+xml') {
        result.recommendations.push('SVG logos are great for scalability. Ensure no embedded scripts for security.');
      } else if (file.type === 'image/png') {
        result.recommendations.push('PNG format is excellent for logos with transparency.');
      } else if (file.type.includes('jpeg')) {
        result.recommendations.push('JPEG format may not be ideal for logos due to compression artifacts. Consider PNG or SVG.');
      }

      if (file.size < 50 * 1024) {
        result.recommendations.push('Very small file size - ensure logo quality is sufficient for all use cases.');
      }

      // 7. Security Checks for SVG
      if (file.type === 'image/svg+xml' && file.data) {
        try {
          const svgContent = atob(file.data);
          const securityIssues = validateSVGSecurity(svgContent);
          
          if (securityIssues.length > 0) {
            result.errors.push(...securityIssues);
            result.isValid = false;
            result.score -= 50;
          }
        } catch (e) {
          result.warnings.push('Could not validate SVG security - manual review recommended');
          result.score -= 5;
        }
      }

      // Ensure score doesn't go below 0
      result.score = Math.max(0, result.score);

      console.log('Validation completed:', result);

      return new Response(
        JSON.stringify({
          success: true,
          validation: result
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
    console.error('Logo validation error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

function validateFileHeader(buffer: Uint8Array, mimeType: string): boolean {
  const signatures: { [key: string]: number[] } = {
    'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/jpg': [0xFF, 0xD8, 0xFF],
    'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
    'image/svg+xml': [0x3C] // < character (XML start)
  };

  const signature = signatures[mimeType];
  if (!signature) return true; // Unknown type, assume valid

  if (buffer.length < signature.length) return false;

  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }

  return true;
}

function validateSVGSecurity(svgContent: string): string[] {
  const securityIssues: string[] = [];

  // Check for script tags
  if (/<script/i.test(svgContent)) {
    securityIssues.push('SVG contains script tags - security risk');
  }

  // Check for javascript: URLs
  if (/javascript:/i.test(svgContent)) {
    securityIssues.push('SVG contains JavaScript URLs - security risk');
  }

  // Check for event handlers
  const eventHandlers = /on\w+\s*=/i;
  if (eventHandlers.test(svgContent)) {
    securityIssues.push('SVG contains event handlers - security risk');
  }

  // Check for external references
  if (/xlink:href\s*=\s*["']https?:/i.test(svgContent)) {
    securityIssues.push('SVG contains external references - potential security risk');
  }

  return securityIssues;
}