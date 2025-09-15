
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Upload, X, ImageIcon, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resizeImage, validateImageFile } from '@/lib/imageProcessing';
import { UploadProgress } from '@/components/ui/upload-progress';
import { handleUploadError } from '@/utils/uploadErrorHandler';

interface ImageUploadProps {
  value?: string;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

export const ImageUpload = ({ value, onChange, disabled, className }: ImageUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Generate unique ID for the file input
  const inputId = React.useId();

  // Cleanup function for object URLs
  const cleanupPreviewUrl = useCallback(() => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  // Sync preview with external value changes
  useEffect(() => {
    console.log("ImageUpload: External value changed to:", value);
    
    // Cleanup previous URL before setting new one
    cleanupPreviewUrl();
    
    if (value && typeof value === 'string') {
      setPreview(value);
    } else {
      setPreview(null);
    }

    // Cleanup function
    return cleanupPreviewUrl;
  }, [value, cleanupPreviewUrl]);

  const validateFile = useCallback((file: File): string | null => {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      return validation.error + (validation.suggestedAction ? ` - ${validation.suggestedAction}` : '');
    }
    return null;
  }, []);

  const processImageWithRetry = useCallback(async (file: File, attempt: number = 1): Promise<File> => {
    const maxAttempts = 3;
    
    try {
      console.log(`Processing image attempt ${attempt}/${maxAttempts}`, {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
      
      // Validate file before processing
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error + (validation.suggestedAction ? ` - ${validation.suggestedAction}` : ''));
      }
      
        // Resize image to max 1200x1200 for better performance and quality
        const resizedBlob = await resizeImage(file, {
          targetWidth: 1200,
          targetHeight: 1200,
          quality: 0.9,
          format: 'jpeg'
        });

      // Convert blob back to file
      const processedFile = new File(
        [resizedBlob], 
        `processed_${file.name.replace(/\.[^/.]+$/, '')}.jpg`,
        { type: 'image/jpeg' }
      );

      console.log('Image processing successful:', {
        originalSize: file.size,
        processedSize: processedFile.size,
        reduction: `${(((file.size - processedFile.size) / file.size) * 100).toFixed(1)}%`
      });

      return processedFile;
    } catch (error) {
      console.error(`Image processing attempt ${attempt} failed:`, error);
      
      // For specific errors, don't retry
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Unsupported file format') || 
          errorMessage.includes('File size') || 
          errorMessage.includes('File is empty')) {
        throw error; // Don't retry validation errors
      }
      
      if (attempt < maxAttempts) {
        console.log(`Retrying image processing... (${attempt + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        return processImageWithRetry(file, attempt + 1);
      }
      
      throw new Error(`Failed to process image after ${maxAttempts} attempts: ${errorMessage}`);
    }
  }, []);

  const handleFileChange = useCallback(async (file: File | null) => {
    setError(null);
    setIsProcessing(false);
    console.log("ImageUpload: handleFileChange called with file:", file?.name, file?.size, file?.type);
    
    if (file) {
      // Validate file first
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      try {
        setIsProcessing(true);
        console.log("ImageUpload: Processing image to 1000x1000px");
        
        // Enhanced validation before processing
        if (!file.type.startsWith('image/')) {
          throw new Error('Selected file is not a valid image');
        }

        // Check if file is readable
        try {
          await new Promise((resolve, reject) => {
            const testReader = new FileReader();
            testReader.onload = resolve;
            testReader.onerror = () => reject(new Error('File cannot be read - it may be corrupted'));
            testReader.readAsArrayBuffer(file.slice(0, 1024)); // Read first 1KB to test
          });
        } catch (readError) {
          throw new Error('File appears to be corrupted or unreadable');
        }
        
        // Process image with enhanced retry logic
        const processedFile = await processImageWithRetry(file);
        
        // Create preview URL with comprehensive error handling
        try {
          cleanupPreviewUrl(); // Clean up previous URL
          
          // Validate processed file before creating preview
          if (!processedFile || processedFile.size === 0) {
            throw new Error('Processed file is invalid');
          }
          
          const previewUrl = URL.createObjectURL(processedFile);
          previewUrlRef.current = previewUrl;
          
          // Test if the URL is valid by creating a temporary image
          await new Promise((resolve, reject) => {
            const testImg = new Image();
            testImg.onload = resolve;
            testImg.onerror = () => reject(new Error('Generated preview is invalid'));
            testImg.src = previewUrl;
          });
          
          setPreview(previewUrl);
          onChange(processedFile);
          setRetryCount(0); // Reset retry count on success
          
          console.log('ImageUpload: Successfully processed and previewing image');
        } catch (previewError) {
          console.error('ImageUpload: Failed to create preview URL:', previewError);
          // Still pass the file even if preview fails
          onChange(processedFile);
          setError('Image processed successfully but preview unavailable. You can still proceed with upload.');
        }
      } catch (error) {
        console.error("ImageUpload: Error processing image:", error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
        
        // Provide specific error messages based on error type
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes('corrupted') || errorMessage.includes('unreadable')) {
          userFriendlyMessage = 'This image file appears to be corrupted. Please try a different image or re-save the file.';
                 } else if (errorMessage.includes('too large') || errorMessage.includes('size')) {
          userFriendlyMessage = 'Image is too large to process. Please use a smaller image (under 20MB).';
        } else if (errorMessage.includes('format') || errorMessage.includes('type')) {
          userFriendlyMessage = 'Unsupported image format. Please use PNG, JPG, or WebP format.';
        } else if (errorMessage.includes('timeout')) {
          userFriendlyMessage = 'Image processing timed out. Please try a smaller image or check your connection.';
        }
        
        setError(userFriendlyMessage);
        setRetryCount(prev => prev + 1);
      } finally {
        setIsProcessing(false);
      }
    } else {
      cleanupPreviewUrl();
      setPreview(null);
      setRetryCount(0);
      console.log("ImageUpload: File removed, clearing preview");
      onChange(file);
    }
  }, [onChange, validateFile, processImageWithRetry, cleanupPreviewUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    console.log("ImageUpload: Files dropped:", files.length);
    if (files.length > 0) {
      handleFileChange(files[0]);
    }
  }, [handleFileChange, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    console.log("ImageUpload: File input changed:", file?.name, file?.size);
    handleFileChange(file);
  }, [handleFileChange]);

  const removeImage = useCallback(() => {
    console.log("ImageUpload: Removing image");
    cleanupPreviewUrl();
    setError(null);
    setRetryCount(0);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    handleFileChange(null);
  }, [handleFileChange, cleanupPreviewUrl]);

  const retryUpload = useCallback(() => {
    setError(null);
    setRetryCount(0);
    // Reset the file input to allow re-selection of the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      {preview ? (
        <div className="relative group">
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg border"
              onLoad={() => {
                console.log("ImageUpload: Preview image loaded successfully");
                setError(null); // Clear any previous errors on successful load
              }}
              onError={(e) => {
                console.error("ImageUpload: Preview image failed to load:", preview, e);
                setError("Failed to display image preview - the image may be corrupted");
              }}
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <div className="text-white text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Processing image...</p>
                  <p className="text-xs opacity-75">Optimizing for web use</p>
                </div>
              </div>
            )}
          </div>
          {!disabled && !isProcessing && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={removeImage}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <div className="mt-2 text-xs text-gray-500 text-center">
            Image will be automatically optimized for web
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
            isDragOver && !disabled ? "border-primary bg-primary/10" : "border-gray-300",
            disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => {
            console.log("ImageUpload: Click detected, disabled:", disabled);
            if (!disabled) {
              document.getElementById(inputId)?.click();
            }
          }}
        >
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-sm text-gray-600 mb-2">
            Drop an image here, or click to select
          </p>
          <p className="text-xs text-gray-400">
            PNG, JPG, WebP up to 20MB
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Images will be automatically optimized for web
          </p>
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            className="hidden"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileInput}
            disabled={disabled || isProcessing}
          />
        </div>
      )}
      
      {/* Enhanced progress/error display */}
      <UploadProgress
        status={isProcessing ? 'processing' : error ? 'error' : 'idle'}
        error={error}
        onRetry={retryUpload}
        onCancel={() => setError(null)}
      />
    </div>
  );
};
