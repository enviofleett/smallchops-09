
import { supabase } from '@/integrations/supabase/client';
import { getPromotions } from './promotions';
import { calculateProductDiscount, ProductWithDiscount, isPromotionValidForCurrentDay } from '@/lib/discountCalculations';

// Memory cache for frequently accessed data
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

const getCachedData = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCachedData = <T>(key: string, data: T, ttlMs: number = 300000) => {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
};

// Optimized single product fetch with caching
export async function getOptimizedProduct(productId: string): Promise<ProductWithDiscount | null> {
  const cacheKey = `product-${productId}`;
  const cached = getCachedData<ProductWithDiscount>(cacheKey);
  if (cached) return cached;

  try {
    const [productPromise, promotionsPromise] = await Promise.allSettled([
      (supabase as any)
        .from('products')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .eq('id', productId)
        .eq('status', 'active')
        .gt('stock_quantity', 0)
        .single(),
      getPromotions()
    ]);

    if (productPromise.status === 'rejected') {
      console.error('Product fetch failed:', productPromise.reason);
      return null;
    }

    const { data: product } = productPromise.value;
    if (!product) return null;

    // Handle promotions gracefully
    const promotions = promotionsPromise.status === 'fulfilled' 
      ? promotionsPromise.value.filter(p => p.status === 'active')
      : [];

    const productWithDiscount = calculateProductDiscount(product, promotions);
    setCachedData(cacheKey, productWithDiscount, 300000); // 5 minutes

    return productWithDiscount;
  } catch (error) {
    console.error('Error fetching optimized product:', error);
    return null;
  }
}

// Optimized categories fetch with caching
export async function getOptimizedCategories() {
  const cacheKey = 'categories-active';
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await (supabase as any)
      .from('categories')
      .select('id, name, slug, description')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    setCachedData(cacheKey, data || [], 600000); // 10 minutes
    return data || [];
  } catch (error) {
    console.error('Error fetching optimized categories:', error);
    return [];
  }
}

// Batch product fetch for cart/wishlist items
export async function getBatchProducts(productIds: string[]): Promise<ProductWithDiscount[]> {
  if (!productIds.length) return [];

  const cacheKey = `batch-products-${productIds.sort().join(',')}`;
  const cached = getCachedData<ProductWithDiscount[]>(cacheKey);
  if (cached) return cached;

  try {
    const [productsPromise, promotionsPromise] = await Promise.allSettled([
      (supabase as any)
        .from('products')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .in('id', productIds)
        .eq('status', 'active'),
      getPromotions()
    ]);

    if (productsPromise.status === 'rejected') {
      console.error('Batch products fetch failed:', productsPromise.reason);
      return [];
    }

    const { data: products } = productsPromise.value;
    if (!products?.length) return [];

    // Handle promotions gracefully
    const promotions = promotionsPromise.status === 'fulfilled' 
      ? promotionsPromise.value.filter(p => p.status === 'active')
      : [];

    const productsWithDiscounts = products.map(product => 
      calculateProductDiscount(product, promotions)
    );

    setCachedData(cacheKey, productsWithDiscounts, 300000); // 5 minutes
    return productsWithDiscounts;
  } catch (error) {
    console.error('Error fetching batch products:', error);
    return [];
  }
}

// Clear cache function for admin operations
export function clearProductsCache() {
  const keysToDelete = Array.from(cache.keys()).filter(key => 
    key.startsWith('product-') || 
    key.startsWith('batch-products-') || 
    key.startsWith('categories-')
  );
  
  keysToDelete.forEach(key => cache.delete(key));
  console.log(`🧹 Cleared ${keysToDelete.length} product cache entries`);
}

// Force fresh product data - bypasses cache completely
export async function getFreshProduct(productId: string): Promise<ProductWithDiscount | null> {
  const cacheKey = `product-${productId}`;
  
  // Force remove from cache
  cache.delete(cacheKey);
  
  console.log(`🔄 Force fetching fresh product: ${productId}`);
  
  try {
    const [productPromise, promotionsPromise] = await Promise.allSettled([
      (supabase as any)
        .from('products')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .eq('id', productId)
        .eq('status', 'active')
        .gt('stock_quantity', 0)
        .single(),
      getPromotions()
    ]);

    if (productPromise.status === 'rejected') {
      console.error('Fresh product fetch failed:', productPromise.reason);
      return null;
    }

    const { data: product } = productPromise.value;
    if (!product) return null;

    const promotions = promotionsPromise.status === 'fulfilled' 
      ? promotionsPromise.value.filter(p => p.status === 'active')
      : [];

    const productWithDiscount = calculateProductDiscount(product, promotions);
    
    // Cache the fresh data with shorter TTL
    setCachedData(cacheKey, productWithDiscount, 60000); // 1 minute only
    
    return productWithDiscount;
  } catch (error) {
    console.error('Error fetching fresh product:', error);
    return null;
  }
}

// Emergency cache clear - removes ALL cached data
export function emergencyCacheClear() {
  cache.clear();
  console.log('🚨 EMERGENCY: All product cache cleared');
}
