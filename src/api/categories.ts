
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
  try {
    console.log('Fetching categories from database...');
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
      
    if (error) {
      console.error('Categories fetch error:', error);
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
    
    console.log('Categories fetched successfully:', data?.length || 0);
    
    // Move customization category to the end
    const categories = data || [];
    const customizationIndex = categories.findIndex(cat => 
      cat.name.toLowerCase().includes('customization')
    );
    
    if (customizationIndex > -1) {
      const customizationCategory = categories.splice(customizationIndex, 1)[0];
      categories.push(customizationCategory);
    }
    
    return categories;
  } catch (error) {
    console.error('Error in getCategories:', error);
    throw error;
  }
};

export const getCategory = async (id: string): Promise<Category | null> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch category: ${error.message}`);
    }
    return data;
  } catch (error) {
    console.error('Error in getCategory:', error);
    throw error;
  }
};

export const createCategory = async (categoryData: NewCategory & { bannerFile?: File }): Promise<Category> => {
  try {
    let bannerUrl: string | null = null;

    if (categoryData.bannerFile) {
      bannerUrl = await uploadCategoryBanner(categoryData.bannerFile);
    }

    const { bannerFile, ...categoryToInsert } = categoryData;
    
    const finalCategoryData = {
      ...categoryToInsert,
      banner_url: bannerUrl,
    };

    console.log('Creating category:', finalCategoryData);
    const { data, error } = await supabase
      .from('categories')
      .insert(finalCategoryData)
      .select()
      .single();
      
    if (error) {
      console.error('Category creation error:', error);
      throw new Error(`Failed to create category: ${error.message}`);
    }
    
    console.log('Category created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in createCategory:', error);
    throw error;
  }
};

export const updateCategory = async (id: string, updates: UpdatedCategory & { bannerFile?: File }): Promise<Category> => {
  try {
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

    console.log('Updating category:', id, finalCategoryUpdates);
    const { data, error } = await supabase
      .from('categories')
      .update(finalCategoryUpdates)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Category update error:', error);
      throw new Error(`Failed to update category: ${error.message}`);
    }
    
    console.log('Category updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in updateCategory:', error);
    throw error;
  }
};

export const deleteCategory = async (id: string): Promise<void> => {
  try {
    // Get category to delete banner
    const category = await getCategory(id);
    
    console.log('Deleting category:', id);
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Category deletion error:', error);
      throw new Error(`Failed to delete category: ${error.message}`);
    }
    
    // Delete banner after successful category deletion
    if (category?.banner_url) {
      await deleteCategoryBanner(category.banner_url);
    }
    
    console.log('Category deleted successfully:', id);
  } catch (error) {
    console.error('Error in deleteCategory:', error);
    throw error;
  }
};
