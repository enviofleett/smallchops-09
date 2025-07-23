import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { removeBackground, loadImage } from "@/lib/backgroundRemoval";

interface LogoUploadProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export const LogoUpload = ({ value, onChange, disabled }: LogoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
      setIsProcessing(true);

      // Load the image for background removal
      const imageElement = await loadImage(file);
      
      // Remove background
      toast.info('Removing background from logo...');
      const processedBlob = await removeBackground(imageElement);
      
      setIsProcessing(false);
      toast.info('Uploading processed logo...');

      // Create file path
      const fileName = `logo_${Date.now()}.png`;

      // Upload processed image to Supabase Storage
      const { data, error } = await supabase.storage
        .from('business-logos')
        .upload(fileName, processedBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png'
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
      toast.success('Logo uploaded with background removed!');
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof Error && error.message.includes('segmentation')) {
        toast.error('Background removal failed. Uploading original image...');
        // Fallback to original upload
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `logo_${Date.now()}.${fileExt}`;
          
          const { data, error } = await supabase.storage
            .from('business-logos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('business-logos')
            .getPublicUrl(data.path);

          setPreview(publicUrl);
          onChange(publicUrl);
          toast.success('Logo uploaded successfully!');
        } catch (fallbackError) {
          toast.error('Failed to upload logo');
        }
      } else {
        toast.error('Failed to process logo');
      }
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  }, [onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxFiles: 1,
    disabled: disabled || isUploading || isProcessing
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
          {isProcessing ? (
            <>
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Removing background...</p>
            </>
          ) : isUploading ? (
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
              <p className="text-xs text-primary">Background will be automatically removed</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};