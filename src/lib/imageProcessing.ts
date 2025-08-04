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

/**
 * Resizes an image to the specified dimensions while maintaining quality
 */
export const resizeImage = async (
  file: File,
  options: ImageResizeOptions
): Promise<Blob> => {
  const { targetWidth, targetHeight, quality = 0.85, format = 'jpeg' } = options;

  return new Promise((resolve, reject) => {
    // Validate inputs
    if (!file || !(file instanceof File)) {
      reject(new Error('Invalid file provided'));
      return;
    }

    if (targetWidth <= 0 || targetHeight <= 0) {
      reject(new Error('Invalid target dimensions'));
      return;
    }

    if (quality < 0 || quality > 1) {
      reject(new Error('Quality must be between 0 and 1'));
      return;
    }

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
      console.error("resizeImage: Failed to load image for processing:", event);
      reject(new Error('Failed to load image - file may be corrupted or invalid format'));
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
 * Creates multiple image variants for a product image
 */
export const createImageVariants = async (file: File): Promise<ImageVariants> => {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size must be less than 10MB');
  }

  try {
    const [thumbnail, medium, full] = await Promise.all([
      resizeImage(file, { targetWidth: 200, targetHeight: 200, quality: 0.8 }),
      resizeImage(file, { targetWidth: 500, targetHeight: 500, quality: 0.85 }),
      resizeImage(file, { targetWidth: 1000, targetHeight: 1000, quality: 0.9 })
    ]);

    return { thumbnail, medium, full };
  } catch (error) {
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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