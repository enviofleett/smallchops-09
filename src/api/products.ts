
import { supabase } from '@/integrations/supabase/client';
import { Product, NewProduct, UpdatedProduct, ProductWithCategory } from '@/types/database';

const PRODUCT_IMAGE_BUCKET = 'products-images';

/**
 * Uploads an image file using the upload-product-image edge function.
 * It handles file conversion to base64 and returns the public URL.
 *
 * @param {File} imageFile - The image file to upload.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
export const uploadProductImage = async (imageFile: File): Promise<string> => {
  const maxRetries = 3;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Image upload attempt ${attempt}/${maxRetries} for file: ${imageFile.name}`);
      
      // Convert file to base64
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = reader.result as string;
            // Remove data URL prefix to get just the base64 data
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(imageFile);
      });

      // Call the upload function with timeout
      const uploadPromise = supabase.functions.invoke('upload-product-image', {
        body: {
          file: {
            name: imageFile.name,
            type: imageFile.type,
            size: imageFile.size,
            data: fileData
          }
        }
      });

      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout - please try again')), 45000)
      );

      const result = await Promise.race([uploadPromise, timeoutPromise]) as any;
      const { data, error } = result;

      // Check for successful response
      if (!error && data && data.success) {
        console.log('Product image uploaded successfully:', data.data.url);
        return data.data.url;
      }

      // Handle error response
      if (error) {
        console.error(`Upload function error (attempt ${attempt}):`, error);
        
        // Check for specific error types that shouldn't be retried
        if (error.message?.includes('Unauthorized') || 
            error.message?.includes('Invalid file type') ||
            error.message?.includes('File size exceeds') ||
            error.message?.includes('Admin access required')) {
          throw new Error(error.message || 'Upload failed');
        }
        
        // Handle rate limiting with longer delays
        if (error.message?.includes('Rate limit exceeded') || 
            error.message?.includes('Maximum 10 uploads per hour')) {
          lastError = new Error('Upload rate limit exceeded. Please wait an hour and try again.');
          
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          // Very long delay for rate limiting (5 minutes, 10 minutes, 15 minutes)
          const delay = attempt * 5 * 60 * 1000;
          console.log(`Rate limited, retrying upload in ${delay/1000/60} minutes...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        lastError = new Error(error.message || 'Upload failed');
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Standard exponential backoff for other errors
        const delay = Math.pow(2, attempt) * 2000;
        console.log(`Retrying upload in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!data?.success) {
        const errorMsg = data?.error || 'Upload failed - unknown error';
        console.error(`Upload failed (attempt ${attempt}):`, errorMsg);
        
        lastError = new Error(errorMsg);
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Retry for server errors
        const delay = Math.pow(2, attempt) * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
    } catch (error: any) {
      console.error(`Upload attempt ${attempt} failed:`, error);
      lastError = error;
      
      // Handle FunctionsHttpError (429 rate limiting)
      if (error.name === 'FunctionsHttpError' || 
          error.message?.includes('Edge Function returned a non-2xx status code')) {
        
        // Try to extract more details from the error
        console.log('FunctionsHttpError details:', {
          name: error.name,
          message: error.message,
          context: error.context,
          stack: error.stack?.split('\n').slice(0, 3)
        });
        
        if (attempt === maxRetries) {
          throw new Error('Upload service temporarily unavailable. Please wait a few minutes and try again.');
        }
        
        // Long delay for any edge function errors (30s, 60s, 120s)
        const delay = Math.pow(2, attempt + 4) * 1000;
        console.log(`Edge function error, waiting ${delay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry for client-side errors
      if (error.message?.includes('timeout') || 
          error.message?.includes('Failed to read file') ||
          error.message?.includes('Unauthorized')) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retry
      const delay = Math.pow(2, attempt) * 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Upload failed after all retry attempts');
};

/**
 * Deletes an image from Supabase storage using its full URL.
 * This is used for cleanup if a product creation or update fails.
 *
 * @param {string} imageUrl - The full public URL of the image to delete.
 */
export const deleteProductImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract the filename from the URL path.
    // Example: '.../product-images/1678881234567-abcdefg.jpg' -> '1678881234567-abcdefg.jpg'
    const urlParts = imageUrl.split('/');
    const filename = urlParts.pop();
    if (!filename) {
      console.error('Could not extract filename from URL:', imageUrl);
      return;
    }

    // Delete the file from the storage bucket
    const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([filename]);

    if (error) {
      console.error('Supabase storage delete error:', error);
    }
  } catch (error) {
    console.error('Error in deleteProductImage:', error);
  }
};

export const getProducts = async (): Promise<ProductWithCategory[]> => {
  try {
    console.log('Fetching products from database...');
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Products fetch error:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
    
    console.log('Products fetched successfully:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('Error in getProducts:', error);
    throw error;
  }
};

export const getProduct = async (id: string): Promise<ProductWithCategory | null> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch product: ${error.message}`);
    }
    return data;
  } catch (error) {
    console.error('Error in getProduct:', error);
    throw error;
  }
};

// Check if SKU already exists
export const checkSkuExists = async (sku: string, excludeId?: string): Promise<boolean> => {
  if (!sku) return false;
  
  let query = supabase.from('products').select('id').eq('sku', sku);
  
  if (excludeId) {
    query = query.neq('id', excludeId);
  }
  
  const { data } = await query.single();
  return !!data;
};

// Generate unique SKU
const generateUniqueSku = async (baseName: string): Promise<string> => {
  const baseSlug = baseName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
  let sku = baseSlug;
  let counter = 1;
  
  while (await checkSkuExists(sku)) {
    sku = `${baseSlug}${counter}`;
    counter++;
  }
  
  return sku;
};

export const createProduct = async (productData: NewProduct & { imageFile?: File }): Promise<Product> => {
    let imageUrl: string | null = null;

    try {
        if (productData.imageFile) {
            imageUrl = await import('@/api/productImageUpload').then(m => m.uploadProductImage(productData.imageFile!));
        }
        
        const { imageFile, ...productToInsert } = productData;

        // Handle SKU validation and generation
        let finalSku = productToInsert.sku;
        if (finalSku && await checkSkuExists(finalSku)) {
            throw new Error(`SKU "${finalSku}" already exists. Please choose a different SKU.`);
        } else if (!finalSku) {
            finalSku = await generateUniqueSku(productToInsert.name);
        }

        const finalProductData = {
            ...productToInsert,
            sku: finalSku,
            image_url: imageUrl,
        };

        const { data, error } = await supabase.from('products').insert(finalProductData).select().single();
        
        if (error) {
            // Cleanup uploaded image if product creation fails
            if (imageUrl) {
                await deleteProductImage(imageUrl);
            }
            
            // Provide specific error message for SKU constraint
            if (error.code === '23505' && error.message.includes('sku')) {
                throw new Error(`SKU "${finalSku}" already exists. Please choose a different SKU.`);
            }
            
            throw new Error(`Failed to create product: ${error.message}`);
        }
        
        return data;
    } catch (error) {
        // Cleanup uploaded image if any error occurs
        if (imageUrl) {
            await deleteProductImage(imageUrl);
        }
        throw error;
    }
};

export const updateProduct = async (id: string, updates: UpdatedProduct & { imageFile?: File }): Promise<Product> => {
    let newImageUrl: string | null = updates.image_url ?? null;
    let oldImageUrl: string | null = null;
    let uploadAttempted: boolean = false;

    try {
        // Handle SKU validation for updates
        if (updates.sku && await checkSkuExists(updates.sku, id)) {
            throw new Error(`SKU "${updates.sku}" already exists. Please choose a different SKU.`);
        }

        // Get current product to access old image URL - do this first
        const { data: currentProduct, error: fetchError } = await supabase
            .from('products')
            .select('image_url')
            .eq('id', id)
            .single();
            
        if (fetchError) {
            throw new Error(`Failed to fetch current product: ${fetchError.message}`);
        }
        
        oldImageUrl = currentProduct?.image_url || null;

        // Upload new image if provided
        if (updates.imageFile) {
            uploadAttempted = true;
            console.log('Uploading new product image...');
            newImageUrl = await import('@/api/productImageUpload').then(m => m.uploadProductImage(updates.imageFile!));
            console.log('New image uploaded successfully:', newImageUrl);
            
            if (!newImageUrl) {
                throw new Error('Image upload failed - no URL returned');
            }
        }
        
        const { imageFile, ...productToUpdate } = updates;
        
        const finalProductUpdates = {
            ...productToUpdate,
            ...(uploadAttempted && { image_url: newImageUrl }), // Only update image_url if we uploaded a new image
        };

        console.log('Updating product in database...', { id, updates: finalProductUpdates });
        
        const { data, error } = await supabase
            .from('products')
            .update(finalProductUpdates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            console.error('Database update failed:', error);
            
            // Cleanup new image if update fails
            if (uploadAttempted && newImageUrl) {
                console.log('Cleaning up uploaded image due to database error...');
                try {
                    await deleteProductImage(newImageUrl);
                } catch (cleanupError) {
                    console.error('Failed to cleanup uploaded image:', cleanupError);
                }
            }
            throw new Error(`Failed to update product: ${error.message}`);
        }
        
        console.log('Product updated successfully');
        
        // Clean up old image only after successful update and if we uploaded a new one
        if (uploadAttempted && oldImageUrl && oldImageUrl !== newImageUrl && newImageUrl) {
            console.log('Cleaning up old image:', oldImageUrl);
            try {
                await deleteProductImage(oldImageUrl);
                console.log('Old image cleaned up successfully');
            } catch (cleanupError) {
                console.error('Failed to cleanup old image (non-critical):', cleanupError);
                // Don't throw here as the update was successful
            }
        }
        
        return data;
    } catch (error) {
        console.error('Product update failed:', error);
        
        // Cleanup new image if any error occurs during update
        if (uploadAttempted && newImageUrl && newImageUrl !== oldImageUrl) {
            console.log('Cleaning up new image due to error...');
            try {
                await deleteProductImage(newImageUrl);
                console.log('Cleanup completed');
            } catch (cleanupError) {
                console.error('Failed to cleanup new image:', cleanupError);
            }
        }
        throw error;
    }
};

export const deleteProduct = async (id: string): Promise<{ action: 'deleted' | 'discontinued'; message: string }> => {
  try {
    const { data, error } = await supabase.rpc('safe_delete_product' as any, { product_id: id });
    
    if (error) {
      // Fallback: try direct deletion if RPC function fails
      console.warn('RPC function failed, attempting direct deletion:', error.message);
      
      // Get product details for image cleanup
      const { data: product } = await supabase
        .from('products')
        .select('image_url')
        .eq('id', id)
        .single();
      
      // Check for orders
      const { count: orderCount } = await supabase
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', id);
      
      if (orderCount && orderCount > 0) {
        // Discontinue product
        await supabase
          .from('products')
          .update({ status: 'discontinued' as any })
          .eq('id', id);
        
        return {
          action: 'discontinued',
          message: 'Product has existing orders and has been discontinued'
        };
      } else {
        // Delete product and image
        await supabase.from('products').delete().eq('id', id);
        
        if (product?.image_url) {
          await deleteProductImage(product.image_url);
        }
        
        return {
          action: 'deleted',
          message: 'Product deleted successfully'
        };
      }
    }
    
    // Clean up image if returned by the function
    if (data?.image_url) {
      await deleteProductImage(data.image_url);
    }
    
    return {
      action: data.action,
      message: data.message
    };
  } catch (error) {
    console.error('Error deleting product:', error);
    throw new Error(`Failed to delete product: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const bulkDeleteProducts = async (productIds: string[]): Promise<{ deleted_count: number; discontinued_count: number; total_processed: number; message: string }> => {
  try {
    const { data, error } = await supabase.rpc('bulk_safe_delete_products' as any, { product_ids: productIds });
    
    if (error) {
      // Fallback: process each product individually
      console.warn('Bulk RPC function failed, processing individually:', error.message);
      
      let deleted_count = 0;
      let discontinued_count = 0;
      const imageUrls: string[] = [];
      
      for (const productId of productIds) {
        try {
          const result = await deleteProduct(productId);
          if (result.action === 'deleted') {
            deleted_count++;
          } else {
            discontinued_count++;
          }
        } catch (error) {
          console.error(`Failed to delete product ${productId}:`, error);
        }
      }
      
      return {
        deleted_count,
        discontinued_count,
        total_processed: deleted_count + discontinued_count,
        message: 'Bulk operation completed with fallback method'
      };
    }
    
    // Clean up images if returned by the function
    if (data?.image_urls && Array.isArray(data.image_urls)) {
      for (const imageUrl of data.image_urls) {
        if (imageUrl) {
          await deleteProductImage(imageUrl);
        }
      }
    }
    
    return {
      deleted_count: data.deleted_count,
      discontinued_count: data.discontinued_count,
      total_processed: data.total_processed,
      message: data.message
    };
  } catch (error) {
    console.error('Error in bulk delete:', error);
    throw new Error(`Failed to delete products: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
