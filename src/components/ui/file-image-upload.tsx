import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Upload, X, ImageIcon, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resizeImage } from '@/lib/imageProcessing';

interface FileImageUploadProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

export const FileImageUpload = ({ value, onChange, disabled, className }: FileImageUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
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
    console.log("FileImageUpload: External value changed to:", value);
    
    // Cleanup previous URL before setting new one
    cleanupPreviewUrl();
    
    if (value instanceof File) {
      const previewUrl = URL.createObjectURL(value);
      previewUrlRef.current = previewUrl;
      setPreview(previewUrl);
    } else {
      setPreview(null);
    }

    // Cleanup function
    return cleanupPreviewUrl;
  }, [value, cleanupPreviewUrl]);

  const validateFile = useCallback((file: File): string | null => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file (JPEG, PNG, WebP, etc.)';
    }
    
    // Check specific supported formats
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type.toLowerCase())) {
      return 'Unsupported image format. Please use JPEG, PNG, WebP, or GIF.';
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return 'Image size must be less than 10MB';
    }

    // Validate file size minimum (1KB)
    if (file.size < 1024) {
      return 'Image file appears to be corrupted or too small';
    }

    return null;
  }, []);

  const processImageWithRetry = useCallback(async (file: File, attempt: number = 1): Promise<File> => {
    const maxRetries = 3;
    
    try {
      console.log(`FileImageUpload: Processing attempt ${attempt}/${maxRetries}`, { 
        name: file.name, 
        size: file.size, 
        type: file.type 
      });

      // Resize image to 1000x1000px
      const resizedBlob = await resizeImage(file, {
        targetWidth: 1000,
        targetHeight: 1000,
        quality: 0.9,
        format: 'jpeg'
      });

      // Create a new File from the resized blob
      const resizedFile = new File([resizedBlob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      console.log('FileImageUpload: Image processing completed', { 
        originalSize: file.size,
        resizedSize: resizedFile.size,
        compressionRatio: (file.size / resizedFile.size).toFixed(2)
      });

      return resizedFile;
    } catch (error) {
      console.error(`FileImageUpload: Processing attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return processImageWithRetry(file, attempt + 1);
      }
      
      throw error;
    }
  }, []);

  const handleFileChange = useCallback(async (file: File | null) => {
    setError(null);
    setIsProcessing(false);
    console.log("FileImageUpload: handleFileChange called with file:", file?.name, file?.size, file?.type);
    
    if (file) {
      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      try {
        setIsProcessing(true);
        console.log("FileImageUpload: Processing image to 1000x1000px");
        
        // Process image with retry logic
        const processedFile = await processImageWithRetry(file);
        
        // Return File object directly
        try {
          cleanupPreviewUrl(); // Clean up previous URL
          const previewUrl = URL.createObjectURL(processedFile);
          previewUrlRef.current = previewUrl;
          setPreview(previewUrl);
          onChange(processedFile);
          setRetryCount(0); // Reset retry count on success
        } catch (previewError) {
          console.error('FileImageUpload: Failed to create preview URL:', previewError);
          // Still pass the file even if preview fails
          onChange(processedFile);
          setError('Image processed successfully but preview unavailable');
        }
      } catch (error) {
        console.error("FileImageUpload: Error processing image:", error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
        setError(errorMessage);
        setRetryCount(prev => prev + 1);
      } finally {
        setIsProcessing(false);
      }
    } else {
      cleanupPreviewUrl();
      setPreview(null);
      setRetryCount(0);
      console.log("FileImageUpload: File removed, clearing preview");
      onChange(file);
    }
  }, [onChange, validateFile, processImageWithRetry, cleanupPreviewUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    console.log("FileImageUpload: Files dropped:", files.length);
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
    console.log("FileImageUpload: File input changed:", file?.name, file?.size);
    handleFileChange(file);
  }, [handleFileChange]);

  const removeImage = useCallback(() => {
    console.log("FileImageUpload: Removing image");
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
                console.log("FileImageUpload: Preview image loaded successfully");
                setError(null); // Clear any previous errors on successful load
              }}
              onError={(e) => {
                console.error("FileImageUpload: Preview image failed to load:", preview, e);
                setError("Failed to display image preview - the image may be corrupted");
              }}
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <div className="text-white text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Processing image...</p>
                  <p className="text-xs opacity-75">Resizing to 1000x1000px</p>
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
            Image will be automatically resized to 1000×1000px
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
            console.log("FileImageUpload: Click detected, disabled:", disabled);
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
            PNG, JPG, WebP up to 10MB
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Images will be automatically resized to 1000×1000px
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
      
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Upload Error</p>
              <p className="text-xs opacity-90 mt-1">{error}</p>
              {retryCount > 0 && (
                <p className="text-xs opacity-75 mt-1">
                  Attempts: {retryCount}/3
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retryUpload}
              className="inline-flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Try Again
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={removeImage}
              className="inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};