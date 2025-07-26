import { supabase } from '@/integrations/supabase/client';
import { ProductWithCategory } from '@/types/database';

export interface CustomerFavorite {
  id: string;
  customer_id: string;
  product_id: string;
  created_at: string;
}

export interface FavoriteProduct extends ProductWithCategory {
  favorite_id: string;
  favorited_at: string;
}

export const addProductToFavorites = async (customerId: string, productId: string): Promise<CustomerFavorite> => {
  const { data, error } = await supabase
    .from('customer_favorites')
    .insert({
      customer_id: customerId,
      product_id: productId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new Error('Product is already in favorites');
    }
    throw new Error(error.message);
  }
  
  return data;
};

export const removeProductFromFavorites = async (customerId: string, productId: string): Promise<void> => {
  const { error } = await supabase
    .from('customer_favorites')
    .delete()
    .eq('customer_id', customerId)
    .eq('product_id', productId);

  if (error) throw new Error(error.message);
};

export const getCustomerFavorites = async (customerId: string): Promise<FavoriteProduct[]> => {
  const { data, error } = await supabase
    .from('customer_favorites')
    .select(`
      id,
      created_at,
      products!inner (
        *,
        categories (
          id,
          name
        )
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  
  return data?.map(favorite => ({
    ...favorite.products,
    favorite_id: favorite.id,
    favorited_at: favorite.created_at,
  })) || [];
};

export const checkIsFavorite = async (customerId: string, productId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('customer_favorites')
    .select('id')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  
  return !!data;
};

export const getFavoritesByProductIds = async (customerId: string, productIds: string[]): Promise<Record<string, boolean>> => {
  const { data, error } = await supabase
    .from('customer_favorites')
    .select('product_id')
    .eq('customer_id', customerId)
    .in('product_id', productIds);

  if (error) throw new Error(error.message);
  
  const favoritesMap: Record<string, boolean> = {};
  productIds.forEach(id => {
    favoritesMap[id] = false;
  });
  
  data?.forEach(favorite => {
    favoritesMap[favorite.product_id] = true;
  });
  
  return favoritesMap;
};