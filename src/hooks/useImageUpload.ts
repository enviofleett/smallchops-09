import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadOptions {
  bucket: 'hero-images' | 'products-images';
  altText?: string;
}

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = async (file: File, options: UploadOptions): Promise<string | null> => {
    setIsUploading(true);
    
    try {
      // Convert file to base64
      const fileData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get just the base64 data
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(file);
      });

      // Get the appropriate function name based on bucket
      const functionName = options.bucket === 'hero-images' ? 'upload-hero-image' : 'upload-product-image';

      // Call the upload function
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            data: fileData
          },
          ...(options.altText && { alt_text: options.altText })
        }
      });

      if (error) {
        console.error('Upload function error:', error);
        throw new Error(error.message || 'Upload failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Upload failed');
      }

      console.log('Image uploaded successfully:', data.data.url);
      return data.data.url;

    } catch (error) {
      console.error('Image upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
      toast.error('Upload failed', {
        description: errorMessage
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadImage,
    isUploading
  };
};