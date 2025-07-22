
import { supabase } from '@/integrations/supabase/client';
import { Product, NewProduct, UpdatedProduct, ProductWithCategory } from '@/types/database';

const BUCKET_NAME = 'product-images';

const uploadProductImage = async (file: File): Promise<string> => {
    const fileName = `${Date.now()}-${file.name.replace(/\s/g, '-')}`;
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file);

    if (error) {
        throw new Error(`Image upload failed: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

    return publicUrl;
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

    if (productData.imageFile) {
        imageUrl = await uploadProductImage(productData.imageFile);
    }
    
    const { imageFile, ...productToInsert } = productData;

    const finalProductData = {
        ...productToInsert,
        image_url: imageUrl,
    };

    const { data, error } = await supabase.from('products').insert(finalProductData).select().single();
    if (error) throw new Error(error.message);
    return data;
};

export const updateProduct = async (id: string, updates: UpdatedProduct & { imageFile?: File }): Promise<Product> => {
    let imageUrl: string | null = updates.image_url ?? null;

    if (updates.imageFile) {
        imageUrl = await uploadProductImage(updates.imageFile);
    }
    
    const { imageFile, ...productToUpdate } = updates;
    
    const finalProductUpdates = {
        ...productToUpdate,
        image_url: imageUrl,
    };

    const { data, error } = await supabase.from('products').update(finalProductUpdates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
};

export const deleteProduct = async (id: string): Promise<void> => {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
};
