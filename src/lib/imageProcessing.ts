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
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
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

        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw resized image
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, targetWidth, targetHeight
        );

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          `image/${format}`,
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