import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useApiWithRetry } from '@/hooks/useApiWithRetry';
import { toast } from 'sonner';
import { EnhancedErrorBoundary } from '@/components/ui/enhanced-error-boundary';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  score: number;
}

interface EnhancedLogoUploadProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  onValidation?: (result: ValidationResult) => void;
}

export const EnhancedLogoUpload = ({ 
  value, 
  onChange, 
  disabled = false,
  onValidation 
}: EnhancedLogoUploadProps) => {
  const { invokeWithRetry } = useApiWithRetry();
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);

  const validateFile = async (file: File): Promise<ValidationResult> => {
    try {
      setValidating(true);
      
      // Convert file to base64 for validation
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/... prefix
        };
        reader.readAsDataURL(file);
      });

      const { data, error } = await invokeWithRetry('validate-logo', {
        body: {
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64
          }
        }
      });

      if (error) throw error;

      return data.validation;
    } finally {
      setValidating(false);
    }
  };

  const uploadFile = async (file: File, altText?: string): Promise<string> => {
    try {
      setUploading(true);
      setUploadProgress(0);

      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/... prefix
        };
        reader.readAsDataURL(file);
      });

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { data, error } = await invokeWithRetry('upload-logo', {
        body: {
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64
          },
          alt_text: altText
        }
      }, {
        maxRetries: 2, // Fewer retries for uploads to avoid duplicates
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      return data.data.url;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    try {
      // Step 1: Validate the file
      const validation = await validateFile(file);
      setValidationResult(validation);
      onValidation?.(validation);

      if (!validation.isValid) {
        toast.error('File validation failed', {
          description: validation.errors[0]
        });
        return;
      }

      if (validation.warnings.length > 0) {
        toast.warning('File has warnings', {
          description: validation.warnings[0]
        });
      }

      // Step 2: Create preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // Step 3: Upload the file
      const logoUrl = await uploadFile(file);
      
      // Step 4: Update the parent component
      onChange(logoUrl);
      
      toast.success('Logo uploaded successfully!', {
        description: 'Your new logo is now active across your application.'
      });

    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast.error('Upload failed', {
        description: error.message || 'An unexpected error occurred'
      });
      setPreviewUrl(value || null);
    }
  }, [value, onChange, onValidation]);

  const removeLogo = () => {
    setPreviewUrl(null);
    setValidationResult(null);
    onChange('');
    toast.success('Logo removed');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp']
    },
    multiple: false,
    disabled: disabled || uploading || validating,
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  if (previewUrl) {
    return (
      <div className="space-y-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Current Logo</h3>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeLogo}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="bg-background border-2 border-dashed border-border rounded-lg p-6 flex items-center justify-center">
              <img 
                src={previewUrl} 
                alt="Business Logo"
                className="max-h-20 max-w-full object-contain"
                onLoad={() => {
                  if (previewUrl?.startsWith('blob:')) {
                    URL.revokeObjectURL(previewUrl);
                  }
                }}
              />
            </div>

            {validationResult && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Quality Score:</span>
                  <Badge variant={validationResult.score >= 80 ? "default" : validationResult.score >= 60 ? "secondary" : "destructive"}>
                    {validationResult.score}/100
                  </Badge>
                </div>
                
                {validationResult.warnings.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {validationResult.warnings[0]}
                    </AlertDescription>
                  </Alert>
                )}

                {validationResult.recommendations.length > 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {validationResult.recommendations[0]}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {!disabled && (
          <Button
            {...getRootProps()}
            variant="outline"
            disabled={uploading || validating}
            className="w-full"
          >
            <input {...getInputProps()} />
            <Upload className="h-4 w-4 mr-2" />
            Upload Different Logo
          </Button>
        )}
      </div>
    );
  }

  return (
    <EnhancedErrorBoundary title="Logo Upload Error" description="There was an issue with the logo upload component.">
      <div className="space-y-4">
        <Card
          {...getRootProps()}
          className={`
            cursor-pointer transition-all duration-200 hover:shadow-md
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/25'}
            ${(uploading || validating) ? 'pointer-events-none opacity-60' : ''}
          `}
        >
        <input {...getInputProps()} />
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            {validating ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Validating file...</p>
                  <p className="text-xs text-muted-foreground">
                    Checking file security and quality
                  </p>
                </div>
              </>
            ) : uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="space-y-2 w-full max-w-xs">
                  <p className="text-sm font-medium">Uploading logo...</p>
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {uploadProgress}% complete
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className={`h-8 w-8 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {isDragActive ? 'Drop your logo here' : 'Upload business logo'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, SVG, WebP up to 5MB
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Recommended: PNG or SVG format for best quality</p>
        <p>• Optimal size: 200x60px to 400x120px</p>
        <p>• Will be automatically validated for security and quality</p>
        </div>
      </div>
    </EnhancedErrorBoundary>
  );
};