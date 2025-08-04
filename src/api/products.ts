
import { supabase } from '@/integrations/supabase/client';
import { Product, NewProduct, UpdatedProduct, ProductWithCategory } from '@/types/database';

const PRODUCT_IMAGE_BUCKET = 'product-images';

/**
 * Uploads an image file to Supabase storage.
 * It generates a unique filename to prevent collisions and returns the public URL.
 *
 * @param {File} imageFile - The image file to upload.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
export const uploadProductImage = async (imageFile: File): Promise<string> => {
  // Generate a unique filename using a combination of a timestamp and the original filename
  // This helps prevent naming conflicts in the storage bucket.
  const fileExtension = imageFile.name.split('.').pop();
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;

  try {
    // Perform the upload to the specified bucket and path
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(filename, imageFile, {
        cacheControl: '3600', // Set cache control for 1 hour
        upsert: false, // Do not overwrite existing files
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      throw new Error(`Failed to upload product image: ${error.message}`);
    }

    // After a successful upload, get the public URL for the file
    const { data: publicUrlData } = supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .getPublicUrl(filename);

    if (!publicUrlData) {
      throw new Error('Failed to retrieve public URL for the uploaded image.');
    }

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadProductImage:', error);
    throw error;
  }
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
  const { data, error } = await supabase
    .from('products')
    .select(`
        *,
        categories (
            id,
            name
        )
    `)
    .order('name');
  if (error) throw new Error(error.message);
  return data || [];
};

export const getProduct = async (id: string): Promise<ProductWithCategory | null> => {
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
      throw new Error(error.message);
    }
    return data;
};

export const createProduct = async (productData: NewProduct & { imageFile?: File }): Promise<Product> => {
    let imageUrl: string | null = null;

    try {
        if (productData.imageFile) {
            imageUrl = await uploadProductImage(productData.imageFile);
        }
        
        const { imageFile, ...productToInsert } = productData;

        const finalProductData = {
            ...productToInsert,
            image_url: imageUrl,
        };

        const { data, error } = await supabase.from('products').insert(finalProductData).select().single();
        
        if (error) {
            // Cleanup uploaded image if product creation fails
            if (imageUrl) {
                await deleteProductImage(imageUrl);
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

    try {
        // Get current product to access old image URL
        if (updates.imageFile) {
            const { data: currentProduct } = await supabase
                .from('products')
                .select('image_url')
                .eq('id', id)
                .single();
            
            oldImageUrl = currentProduct?.image_url || null;
            newImageUrl = await uploadProductImage(updates.imageFile);
        }
        
        const { imageFile, ...productToUpdate } = updates;
        
        const finalProductUpdates = {
            ...productToUpdate,
            image_url: newImageUrl,
        };

        const { data, error } = await supabase.from('products').update(finalProductUpdates).eq('id', id).select().single();
        
        if (error) {
            // Cleanup new image if update fails
            if (updates.imageFile && newImageUrl) {
                await deleteProductImage(newImageUrl);
            }
            throw new Error(`Failed to update product: ${error.message}`);
        }
        
        // Clean up old image only after successful update
        if (updates.imageFile && oldImageUrl && oldImageUrl !== newImageUrl) {
            await deleteProductImage(oldImageUrl);
        }
        
        return data;
    } catch (error) {
        // Cleanup new image if any error occurs during update
        if (updates.imageFile && newImageUrl && newImageUrl !== oldImageUrl) {
            await deleteProductImage(newImageUrl);
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
