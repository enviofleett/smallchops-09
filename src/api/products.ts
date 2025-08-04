
import { supabase } from '@/integrations/supabase/client';
import { Product, NewProduct, UpdatedProduct, ProductWithCategory } from '@/types/database';

const BUCKET_NAME = 'product-images';

const validateImageFile = (file: File): void => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB - allowing for high quality 1000x1000 images

    if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
    }

    if (file.size > maxSize) {
        throw new Error('File size too large. Please upload an image smaller than 10MB.');
    }
};

const sanitizeFileName = (fileName: string): string => {
    return fileName
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();
};

const uploadProductImage = async (file: File): Promise<string> => {
    console.log('uploadProductImage: Starting upload process', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
    });

    try {
        validateImageFile(file);
        
        // Generate timestamp-based filename for better organization
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2);
        const fileName = `products/product-${timestamp}-${randomId}.jpg`;
        
        console.log('uploadProductImage: Generated filename:', fileName);

        // Upload with retry logic
        let uploadAttempt = 1;
        const maxRetries = 3;
        
        while (uploadAttempt <= maxRetries) {
            try {
                const { data, error } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(fileName, file, {
                        cacheControl: '86400', // Cache for 24 hours
                        upsert: false,
                        contentType: 'image/jpeg'
                    });

                if (error) {
                    console.error(`uploadProductImage: Upload attempt ${uploadAttempt} failed:`, error);
                    
                    if (uploadAttempt === maxRetries) {
                        throw new Error(`Failed to upload image after ${maxRetries} attempts: ${error.message}`);
                    }
                    
                    // Wait before retry (exponential backoff)
                    const delay = Math.pow(2, uploadAttempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    uploadAttempt++;
                    continue;
                }

                console.log('uploadProductImage: Upload successful on attempt', uploadAttempt, 'data:', data);

                // Get the public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(data.path);

                console.log('uploadProductImage: Generated public URL:', publicUrl);

                if (!publicUrl) {
                    throw new Error('Failed to generate public URL for uploaded image');
                }

                // Verify the uploaded file exists
                const { data: fileData, error: fileError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .list('products', {
                        search: fileName.split('/')[1]
                    });

                if (fileError || !fileData?.length) {
                    console.warn('uploadProductImage: File verification failed, but continuing with URL');
                }

                return publicUrl;
            } catch (attemptError) {
                if (uploadAttempt === maxRetries) {
                    throw attemptError;
                }
                console.warn(`uploadProductImage: Attempt ${uploadAttempt} failed, retrying...`, attemptError);
                uploadAttempt++;
            }
        }

        throw new Error('Upload failed after all retry attempts');
    } catch (error) {
        console.error('uploadProductImage: Upload process failed:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to upload image due to an unexpected error');
    }
};

const deleteProductImage = async (imageUrl: string): Promise<void> => {
    if (!imageUrl) return;
    
    try {
        // Extract file path from public URL
        const urlParts = imageUrl.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
        if (urlParts.length === 2) {
            const filePath = urlParts[1];
            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .remove([filePath]);
            
            if (error) {
                console.error('Failed to delete image from storage:', error);
            }
        }
    } catch (error) {
        console.error('Error deleting product image:', error);
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
