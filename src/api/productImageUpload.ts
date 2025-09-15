import { supabase } from '@/integrations/supabase/client';

/**
 * Simplified product image upload - Production ready with no artificial limits
 */
export const uploadProductImage = async (imageFile: File): Promise<string> => {
  try {
    console.log('Starting simplified image upload for:', imageFile.name, `${(imageFile.size / 1024 / 1024).toFixed(2)}MB`);
    
    // Basic validation
    if (!imageFile || imageFile.size === 0) {
      throw new Error('Invalid or empty file');
    }
    
    if (imageFile.size > 20 * 1024 * 1024) { // 20MB limit
      throw new Error('File too large - maximum size is 20MB');
    }
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(imageFile.type)) {
      throw new Error('Unsupported file type - use JPG, PNG, WebP, or GIF');
    }

    // Convert to base64
    const fileData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(imageFile);
    });

    // Upload using simplified function
    const { data, error } = await supabase.functions.invoke('simplified-product-upload', {
      body: {
        file: {
          name: imageFile.name,
          type: imageFile.type,
          size: imageFile.size,
          data: fileData
        }
      }
    });

    if (error) {
      console.error('Upload error:', error);
      throw new Error(error.message || 'Upload failed');
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Upload failed - unknown error');
    }

    if (!data.data?.url) {
      throw new Error('Upload succeeded but no URL returned');
    }

    console.log('Upload successful:', data.data.url);
    return data.data.url;

  } catch (error) {
    console.error('Product image upload failed:', error);
    throw error;
  }
};