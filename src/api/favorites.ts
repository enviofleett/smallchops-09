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
  console.log('🔍 Adding to favorites:', { customerId, productId });
  
  const { data, error } = await (supabase as any)
    .from('customer_favorites')
    .insert({
      customer_id: customerId,
      product_id: productId,
    })
    .select()
    .single();

  console.log('🔍 Add favorite result:', { data, error });

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new Error('Product is already in favorites');
    }
    throw new Error(error.message);
  }
  
  return data as CustomerFavorite;
};

export const removeProductFromFavorites = async (customerId: string, productId: string): Promise<void> => {
  const { error } = await (supabase as any)
    .from('customer_favorites')
    .delete()
    .eq('customer_id', customerId)
    .eq('product_id', productId);

  if (error) throw new Error(error.message);
};

export const getCustomerFavorites = async (customerId: string): Promise<FavoriteProduct[]> => {
  console.log('🔍 Getting favorites for customer:', customerId);
  
  const { data, error } = await (supabase as any)
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
  
  console.log('🔍 Favorites data returned:', data?.length || 0);
  
  return data?.map((favorite: any) => ({
    ...favorite.products,
    favorite_id: favorite.id,
    favorited_at: favorite.created_at,
  })) || [];
};

export const checkIsFavorite = async (customerId: string, productId: string): Promise<boolean> => {
  const { data, error } = await (supabase as any)
    .from('customer_favorites')
    .select('id')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  
  return !!data;
};

export const getFavoritesByProductIds = async (customerId: string, productIds: string[]): Promise<Record<string, boolean>> => {
  const { data, error } = await (supabase as any)
    .from('customer_favorites')
    .select('product_id')
    .eq('customer_id', customerId)
    .in('product_id', productIds);

  if (error) throw new Error(error.message);
  
  const favoritesMap: Record<string, boolean> = {};
  productIds.forEach(id => {
    favoritesMap[id] = false;
  });
  
  data?.forEach((favorite: any) => {
    favoritesMap[favorite.product_id] = true;
  });
  
  return favoritesMap;
};