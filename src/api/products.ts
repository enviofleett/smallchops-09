
import { supabase } from '@/integrations/supabase/client';
import { Product, NewProduct, UpdatedProduct, ProductWithCategory } from '@/types/database';

const PRODUCT_IMAGE_BUCKET = 'product-images';

/**
 * Uploads an image file using the upload-product-image edge function.
 * It handles file conversion to base64 and returns the public URL.
 *
 * @param {File} imageFile - The image file to upload.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
export const uploadProductImage = async (imageFile: File): Promise<string> => {
  try {
    // Convert file to base64
    const fileData = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 data
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.readAsDataURL(imageFile);
    });

    // Call the upload function
    const { data, error } = await supabase.functions.invoke('upload-product-image', {
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
      console.error('Upload function error:', error);
      throw new Error(error.message || 'Upload failed');
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Upload failed');
    }

    console.log('Product image uploaded successfully:', data.data.url);
    return data.data.url;
  } catch (error) {
    console.error('Product image upload error:', error);
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
            imageUrl = await uploadProductImage(productData.imageFile);
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
            newImageUrl = await uploadProductImage(updates.imageFile);
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
