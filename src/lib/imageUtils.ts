/**
 * Centralized image utilities for handling product images consistently across the app.
 * Normalizes various image data structures to a consistent string array format.
 */

export interface ImageSource {
  image_url?: string | null;
  images?: string[] | null;
}

/**
 * Converts various image data structures to a consistent string array.
 * Handles both single image_url and images array formats.
 * Returns empty array if no valid images are found.
 */
export function toImagesArray(source: ImageSource | null | undefined): string[] {
  if (!source) return [];
  
  // If images array exists and has content, use it
  if (source.images && Array.isArray(source.images) && source.images.length > 0) {
    return source.images.filter(Boolean);
  }
  
  // Fallback to single image_url if available
  if (source.image_url && typeof source.image_url === 'string') {
    return [source.image_url];
  }
  
  return [];
}

/**
 * Gets the first image from an image source, or returns a placeholder.
 */
export function getFirstImage(source: ImageSource | null | undefined, placeholder = '/placeholder.svg'): string {
  const images = toImagesArray(source);
  return images.length > 0 ? images[0] : placeholder;
}

/**
 * Checks if an image source has any valid images.
 */
export function hasImages(source: ImageSource | null | undefined): boolean {
  return toImagesArray(source).length > 0;
}