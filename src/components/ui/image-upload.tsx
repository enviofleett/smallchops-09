
import React, { useCallback, useState, useEffect } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  
  // Generate unique ID for the file input
  const inputId = React.useId();

  // Sync preview with external value changes
  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  const handleFileChange = useCallback((file: File | null) => {
    setError(null);
    console.log("ImageUpload: handleFileChange called with file:", file?.name);
    
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      console.log("ImageUpload: Creating preview for file:", file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
        console.log("ImageUpload: Preview created successfully");
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
      console.log("ImageUpload: File removed, clearing preview");
    }
    
    console.log("ImageUpload: Calling onChange with file:", file?.name);
    onChange(file);
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
    console.log("ImageUpload: File input changed:", file?.name);
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
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg border"
          />
          {!disabled && (
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
            PNG, JPG, WebP up to 5MB
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
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
};
