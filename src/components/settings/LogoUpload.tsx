import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";


interface LogoUploadProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export const LogoUpload = ({ value, onChange, disabled }: LogoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  
  const [preview, setPreview] = useState<string | null>(value || null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setIsUploading(true);

      // Create file path
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;

      // Upload the original file directly
      const uploadBlob = file;
      const uploadContentType = file.type;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('business-logos')
        .upload(fileName, uploadBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: uploadContentType
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('business-logos')
        .getPublicUrl(data.path);

      setPreview(publicUrl);
      onChange(publicUrl);
      toast.success('Logo uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload logo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxFiles: 1,
    disabled: disabled || isUploading
  });

  const removeLogo = () => {
    setPreview(null);
    onChange('');
  };

  if (preview) {
    return (
      <Card className="relative w-32 h-32 overflow-hidden">
        <img 
          src={preview} 
          alt="Business logo" 
          className="w-full h-full object-contain bg-muted"
        />
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="absolute top-2 right-2"
          onClick={removeLogo}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Business Logo</label>
      <Card
        {...getRootProps()}
        className={`
          w-full h-32 border-2 border-dashed cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center h-full space-y-2 p-4">
          {isUploading ? (
            <>
              <Upload className="h-8 w-8 text-muted-foreground animate-pulse" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                {isDragActive
                  ? "Drop your logo here..."
                  : "Click to upload or drag and drop your logo"}
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};