
import { supabase } from '@/integrations/supabase/client';
import { Category, NewCategory, UpdatedCategory } from '@/types/database';

const BUCKET_NAME = 'category-banners';

const uploadCategoryBanner = async (file: File): Promise<string> => {
  const fileName = `${Date.now()}-${file.name.replace(/\s/g, '-')}`;
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file);

  if (error) {
    throw new Error(`Banner upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicUrl;
};

const deleteCategoryBanner = async (bannerUrl: string): Promise<void> => {
  if (!bannerUrl) return;
  
  // Extract file path from URL
  const fileName = bannerUrl.split('/').pop();
  if (!fileName) return;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([fileName]);

  if (error) {
    console.warn('Failed to delete banner:', error.message);
  }
};

export const getCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw new Error(error.message);
  return data || [];
};

export const getCategory = async (id: string): Promise<Category | null> => {
    const { data, error } = await supabase.from('categories').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(error.message);
    }
    return data;
};

export const createCategory = async (categoryData: NewCategory & { bannerFile?: File }): Promise<Category> => {
  let bannerUrl: string | null = null;

  if (categoryData.bannerFile) {
    bannerUrl = await uploadCategoryBanner(categoryData.bannerFile);
  }

  const { bannerFile, ...categoryToInsert } = categoryData;
  
  const finalCategoryData = {
    ...categoryToInsert,
    banner_url: bannerUrl,
  };

  const { data, error } = await supabase.from('categories').insert(finalCategoryData).select().single();
  if (error) throw new Error(error.message);
  return data;
};

export const updateCategory = async (id: string, updates: UpdatedCategory & { bannerFile?: File }): Promise<Category> => {
  let bannerUrl: string | null = updates.banner_url ?? null;

  // If new banner file is provided, upload it
  if (updates.bannerFile) {
    // Delete old banner if exists
    const existingCategory = await getCategory(id);
    if (existingCategory?.banner_url) {
      await deleteCategoryBanner(existingCategory.banner_url);
    }
    
    bannerUrl = await uploadCategoryBanner(updates.bannerFile);
  }

  const { bannerFile, ...categoryToUpdate } = updates;
  
  const finalCategoryUpdates = {
    ...categoryToUpdate,
    banner_url: bannerUrl,
  };

  const { data, error } = await supabase.from('categories').update(finalCategoryUpdates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  // Get category to delete banner
  const category = await getCategory(id);
  
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
  
  // Delete banner after successful category deletion
  if (category?.banner_url) {
    await deleteCategoryBanner(category.banner_url);
  }
};
