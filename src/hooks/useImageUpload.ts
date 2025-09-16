import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { handleUploadError, UploadErrorHandler } from '@/utils/uploadErrorHandler';

interface UploadOptions {
  bucket: 'hero-images' | 'products-images';
  altText?: string;
}

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = async (file: File, options: UploadOptions): Promise<string | null> => {
    setIsUploading(true);
    
    try {
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Upload attempt ${attempt}/${maxRetries} for file:`, file.name);

          // Convert file to base64 with timeout
          const fileData = await Promise.race([
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const result = reader.result as string;
                  if (!result || typeof result !== 'string') {
                    reject(new Error('Failed to read file - invalid file data'));
                    return;
                  }
                  // Remove data URL prefix to get just the base64 data
                  const base64Data = result.split(',')[1];
                  if (!base64Data) {
                    reject(new Error('Invalid file format - could not extract base64 data'));
                    return;
                  }
                  resolve(base64Data);
                } catch (error) {
                  reject(new Error('Failed to process file data'));
                }
              };
              reader.onerror = () => reject(new Error('Failed to read file - file may be corrupted'));
              reader.onabort = () => reject(new Error('File reading was aborted'));
              reader.readAsDataURL(file);
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('File reading timed out - file may be too large')), 30000)
            )
          ]);

          // Get the appropriate function name based on bucket
          const functionName = options.bucket === 'hero-images' ? 'upload-hero-image' : 'upload-product-image';

          // Call the upload function with timeout
          const uploadResponse = await Promise.race([
            supabase.functions.invoke(functionName, {
              body: {
                file: {
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  data: fileData
                },
                ...(options.altText && { alt_text: options.altText })
              }
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Upload request timed out - please try again')), 60000)
            )
          ]);

          const { data, error } = uploadResponse;

          if (error) {
            console.error(`Upload attempt ${attempt} - Function error:`, error);
            const errorMessage = error.message || 'Upload function failed';
            
            // Check for specific error types that shouldn't be retried
            if (errorMessage.includes('Unauthorized') || 
                errorMessage.includes('Admin access') ||
                errorMessage.includes('Rate limit') ||
                errorMessage.includes('Invalid file type') ||
                errorMessage.includes('File size exceeds')) {
              throw new Error(errorMessage); // Don't retry these errors
            }
            
            lastError = new Error(errorMessage);
            if (attempt === maxRetries) throw lastError;
            
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }

          if (!data?.success) {
            const errorMessage = data?.error || 'Upload failed - unknown error';
            console.error(`Upload attempt ${attempt} - Server error:`, errorMessage);
            
            lastError = new Error(errorMessage);
            if (attempt === maxRetries) throw lastError;
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }

          if (!data.data?.url) {
            throw new Error('Upload succeeded but no URL returned');
          }

          console.log(`Upload successful on attempt ${attempt}:`, data.data.url);
          toast.success('Image uploaded successfully!');
          return data.data.url;

        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown upload error');
          console.error(`Upload attempt ${attempt} failed:`, lastError.message);
          
          // Check if this is a non-retryable error
          if (lastError.message.includes('Unauthorized') || 
              lastError.message.includes('Admin access') ||
              lastError.message.includes('Rate limit') ||
              lastError.message.includes('Invalid file type') ||
              lastError.message.includes('File size exceeds') ||
              lastError.message.includes('Invalid file format')) {
            throw lastError; // Don't retry these errors
          }
          
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }

      throw lastError || new Error('Upload failed after all retry attempts');

    } catch (error) {
      // Use the comprehensive error handler
      const analysis = handleUploadError(error, {
        fileSize: file.size,
        fileType: file.type,
        fileName: file.name
      });

      const userMessage = UploadErrorHandler.generateUserMessage(analysis);
      
      toast.error('Upload failed', {
        description: userMessage,
        action: analysis.primaryError.retryable ? {
          label: 'Retry',
          onClick: () => window.location.reload()
        } : undefined
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