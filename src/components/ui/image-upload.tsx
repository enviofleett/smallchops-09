
import React, { useCallback, useState, useEffect } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resizeImage } from '@/lib/imageProcessing';

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
  
  // Generate unique ID for the file input
  const inputId = React.useId();

  // Sync preview with external value changes
  useEffect(() => {
    console.log("ImageUpload: External value changed to:", value);
    setPreview(value || null);
  }, [value]);

  const handleFileChange = useCallback(async (file: File | null) => {
    setError(null);
    setIsProcessing(false);
    console.log("ImageUpload: handleFileChange called with file:", file?.name, file?.size, file?.type);
    
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file (PNG, JPG, WebP)');
        return;
      }

      // Validate file size (10MB max for processing)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      try {
        setIsProcessing(true);
        console.log("ImageUpload: Processing image to 1000x1000px");
        
        // Resize image to 1000x1000px
        const resizedBlob = await resizeImage(file, {
          targetWidth: 1000,
          targetHeight: 1000,
          quality: 0.9,
          format: 'jpeg'
        });
        
        // Create File object from blob
        const resizedFile = new File([resizedBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        
        console.log("ImageUpload: Image processed successfully", {
          originalSize: file.size,
          newSize: resizedFile.size,
          dimensions: '1000x1000px'
        });
        
        // Create preview URL
        const previewUrl = URL.createObjectURL(resizedBlob);
        console.log("ImageUpload: Created preview URL:", previewUrl);
        
        // Set preview and clear processing state
        setPreview(previewUrl);
        setIsProcessing(false);
        
        // Pass the resized file to parent
        onChange(resizedFile);
        
        // Clean up previous preview URL if it exists
        return () => {
          URL.revokeObjectURL(previewUrl);
        };
      } catch (error) {
        console.error("ImageUpload: Error processing image:", error);
        setError(error instanceof Error ? error.message : 'Failed to process image');
        setIsProcessing(false);
        setPreview(null);
      }
    } else {
      setPreview(null);
      console.log("ImageUpload: File removed, clearing preview");
      onChange(file);
    }
  }, [onChange]);

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
    handleFileChange(null);
  }, [handleFileChange]);

  return (
    <div className={cn("space-y-2", className)}>
      {preview ? (
        <div className="relative group">
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg border"
              onError={(e) => {
                console.error("ImageUpload: Failed to load preview image:", preview);
                console.error("ImageUpload: Image error event:", e);
                setError("Failed to load image preview");
                setPreview(null); // Clear the preview to avoid showing broken image
              }}
              onLoad={() => {
                console.log("ImageUpload: Preview image loaded successfully");
                setError(null); // Clear any previous error when image loads successfully
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
            PNG, JPG, WebP up to 10MB
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Images will be automatically resized to 1000×1000px
          </p>
          <input
            id={inputId}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileInput}
            disabled={disabled}
          />
        </div>
      )}
      
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          {error.includes("Failed to load image") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                setPreview(null);
                console.log("ImageUpload: Error cleared, resetting component");
              }}
            >
              Try Again
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
