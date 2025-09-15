interface ImageResizeOptions {
  targetWidth: number;
  targetHeight: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

interface ImageVariants {
  thumbnail: Blob;
  medium: Blob;
  full: Blob;
}

interface FileValidationResult {
  isValid: boolean;
  error?: string;
  suggestedAction?: string;
}

/**
 * Supported image MIME types
 */
const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
]);

/**
 * Maximum file size (20MB) - Production limit
 */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Validates image file format and properties
 */
export const validateImageFile = (file: File): FileValidationResult => {
  console.log('validateImageFile: Starting validation', { 
    name: file.name, 
    type: file.type, 
    size: file.size 
  });

  // Check if file exists
  if (!file || !(file instanceof File)) {
    return {
      isValid: false,
      error: 'No file provided',
      suggestedAction: 'Please select a valid image file'
    };
  }

  // Check file size
  if (file.size === 0) {
    return {
      isValid: false,
      error: 'File is empty',
      suggestedAction: 'Please select a different image file'
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `File size (${sizeMB}MB) exceeds the 20MB limit`,
      suggestedAction: 'Please compress your image or choose a smaller file'
    };
  }

  // Check MIME type
  if (!SUPPORTED_MIME_TYPES.has(file.type)) {
    return {
      isValid: false,
      error: `Unsupported file format: ${file.type}`,
      suggestedAction: 'Please use PNG, JPG, WebP, GIF, or SVG format'
    };
  }

  // Check file extension matches MIME type
  const fileName = file.name.toLowerCase();
  const expectedExtensions = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
    'image/svg+xml': ['.svg']
  };

  const validExtensions = expectedExtensions[file.type as keyof typeof expectedExtensions];
  if (validExtensions && !validExtensions.some(ext => fileName.endsWith(ext))) {
    return {
      isValid: false,
      error: 'File extension does not match file type',
      suggestedAction: 'Please ensure your file has the correct extension'
    };
  }

  // Additional file integrity checks
  try {
    // Check for malformed files by trying to read basic properties
    if (!file.name || file.name.trim().length === 0) {
      return {
        isValid: false,
        error: 'Invalid file name',
        suggestedAction: 'Please ensure the file has a valid name'
      };
    }

    // Check for suspicious file patterns that might indicate corruption
    if (file.type === 'image/jpeg' && file.size < 1024) {
      return {
        isValid: false,
        error: 'JPEG file appears too small to be valid',
        suggestedAction: 'Please check if the file is corrupted'
      };
    }

    if (file.type === 'image/png' && file.size < 1024) {
      return {
        isValid: false,
        error: 'PNG file appears too small to be valid',
        suggestedAction: 'Please check if the file is corrupted'
      };
    }

  } catch (error) {
    return {
      isValid: false,
      error: 'File appears to be corrupted or invalid',
      suggestedAction: 'Please try a different image file'
    };
  }

  console.log('validateImageFile: Validation passed successfully');
  return { isValid: true };
};

/**
 * Resizes an image to the specified dimensions with enhanced error handling
 */
export const resizeImage = async (
  file: File,
  options: ImageResizeOptions
): Promise<Blob> => {
  const { targetWidth, targetHeight, quality = 0.85, format = 'jpeg' } = options;

  // Validate file first
  const validation = validateImageFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error + (validation.suggestedAction ? ` - ${validation.suggestedAction}` : ''));
  }

  // Validate resize options
  if (targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('Invalid target dimensions - width and height must be positive numbers');
  }

  if (quality < 0 || quality > 1) {
    throw new Error('Quality must be between 0 and 1');
  }

  return new Promise((resolve, reject) => {

    const img = new Image();
    let objectUrl: string | null = null;
    
    // Cleanup function
    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    img.onload = () => {
      try {
        console.log("resizeImage: Image loaded successfully", { 
          originalWidth: img.width, 
          originalHeight: img.height,
          targetWidth,
          targetHeight,
          fileSize: file.size,
          fileType: file.type
        });

        // Validate image dimensions
        if (img.width === 0 || img.height === 0) {
          throw new Error('Invalid image dimensions - image may be corrupted');
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: format === 'png' });
        
        if (!ctx) {
          throw new Error('Canvas not supported in this browser');
        }

        // Set canvas dimensions to target size
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Calculate aspect ratios
        const sourceAspect = img.width / img.height;
        const targetAspect = targetWidth / targetHeight;

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = img.width;
        let sourceHeight = img.height;

        // Crop to fit target aspect ratio (center crop)
        if (sourceAspect > targetAspect) {
          // Source is wider - crop sides
          sourceWidth = img.height * targetAspect;
          sourceX = (img.width - sourceWidth) / 2;
        } else if (sourceAspect < targetAspect) {
          // Source is taller - crop top/bottom
          sourceHeight = img.width / targetAspect;
          sourceY = (img.height - sourceHeight) / 2;
        }

        // Configure high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill background for JPEG format
        if (format === 'jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
        }

        // Draw resized image
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, targetWidth, targetHeight
        );

        console.log("resizeImage: Canvas drawing completed, converting to blob");

        // Convert to blob with timeout
        const blobTimeout = setTimeout(() => {
          cleanup();
          reject(new Error('Image conversion timed out'));
        }, 10000); // 10 second timeout

        canvas.toBlob(
          (blob) => {
            clearTimeout(blobTimeout);
            cleanup();
            
            if (blob) {
              console.log("resizeImage: Blob created successfully", { 
                originalSize: file.size,
                processedSize: blob.size,
                type: blob.type,
                compressionRatio: (file.size / blob.size).toFixed(2)
              });
              resolve(blob);
            } else {
              reject(new Error('Failed to create image blob - browser may not support this format'));
            }
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        cleanup();
        console.error("resizeImage: Error during processing:", error);
        reject(new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    img.onerror = (event) => {
      cleanup();
      console.error("resizeImage: Failed to load image for processing:", event, {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
      
      let errorMessage = 'Failed to load image';
      let suggestion = '';
      
      // Provide specific guidance based on file type
      if (file.type === 'image/svg+xml') {
        errorMessage = 'SVG processing failed';
        suggestion = 'SVG files may have compatibility issues. Try converting to PNG or JPG.';
      } else if (file.size > 5 * 1024 * 1024) {
        errorMessage = 'Large image failed to load';
        suggestion = 'Try compressing the image or using a smaller file.';
      } else if (!SUPPORTED_MIME_TYPES.has(file.type)) {
        errorMessage = `Unsupported format: ${file.type}`;
        suggestion = 'Please use PNG, JPG, WebP, GIF, or SVG format.';
      } else {
        errorMessage = 'Image file appears to be corrupted or invalid';
        suggestion = 'Try opening the file in an image editor and re-saving it.';
      }
      
      reject(new Error(`${errorMessage} - ${suggestion}`));
    };
    
    try {
      objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      console.log("resizeImage: Created object URL for image processing");
    } catch (error) {
      cleanup();
      console.error("resizeImage: Failed to create object URL:", error);
      reject(new Error('Failed to process file - invalid image data'));
    }
  });
};

/**
 * Creates multiple image variants with fallback processing
 */
export const createImageVariants = async (file: File): Promise<ImageVariants> => {
  console.log('createImageVariants: Starting variant creation', {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size
  });

  // Validate file first
  const validation = validateImageFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error + (validation.suggestedAction ? ` - ${validation.suggestedAction}` : ''));
  }

  try {
    // Process variants with enhanced error handling
    const [thumbnail, medium, full] = await Promise.all([
      resizeImage(file, { targetWidth: 200, targetHeight: 200, quality: 0.8 }),
      resizeImage(file, { targetWidth: 500, targetHeight: 500, quality: 0.85 }),
      resizeImage(file, { targetWidth: 1000, targetHeight: 1000, quality: 0.9 })
    ]);

    console.log('createImageVariants: Successfully created all variants');
    return { thumbnail, medium, full };
  } catch (error) {
    console.error('createImageVariants: Failed to create variants', error);
    
    // If processing fails, try fallback with lower quality/simpler processing
    try {
      console.log('createImageVariants: Attempting fallback processing');
      const fallbackBlob = await createFallbackImage(file);
      
      // Use the same blob for all variants as fallback
      return {
        thumbnail: fallbackBlob,
        medium: fallbackBlob,
        full: fallbackBlob
      };
    } catch (fallbackError) {
      console.error('createImageVariants: Fallback processing also failed', fallbackError);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

/**
 * Fallback image processing for when standard processing fails
 */
export const createFallbackImage = async (file: File): Promise<Blob> => {
  console.log('createFallbackImage: Attempting simple conversion');
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;
    
    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Canvas not supported');
        }

        // Simple resize to 1000px max dimension
        const maxDimension = 1000;
        let { width, height } = img;
        
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              console.log('createFallbackImage: Fallback processing successful');
              resolve(blob);
            } else {
              reject(new Error('Fallback conversion failed'));
            }
          },
          'image/jpeg',
          0.8
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Cannot process this image file - it may be corrupted'));
    };
    
    try {
      objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
    } catch (error) {
      cleanup();
      reject(new Error('Failed to read image file'));
    }
  });
};

/**
 * Compresses an image while maintaining dimensions
 */
export const compressImage = async (
  file: File,
  quality: number = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Gets image dimensions from a file
 */
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};