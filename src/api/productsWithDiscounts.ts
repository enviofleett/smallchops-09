import { supabase } from "@/integrations/supabase/client";
import { getPromotions } from "./promotions";
import { calculateProductDiscount, ProductWithDiscount, isPromotionValidForCurrentDay } from "@/lib/discountCalculations";

// Cache for products to avoid repeated queries
let productsCache: { data: any[]; timestamp: number; categoryId?: string } | null = null;
const PRODUCTS_CACHE_DURATION = 3 * 60 * 1000; // 3 minutes

// Clear products cache
export function clearProductsCache() {
  productsCache = null;
  console.log('Products cache cleared');
}

// Get products with calculated discounts - Optimized for faster loading
export async function getProductsWithDiscounts(categoryId?: string): Promise<ProductWithDiscount[]> {
  try {
    // Check cache first
    if (productsCache &&
        (Date.now() - productsCache.timestamp) < PRODUCTS_CACHE_DURATION &&
        productsCache.categoryId === categoryId) {
      console.log('Using cached products data');

      // Still get fresh promotions for discount calculations
      const promotions = await getPromotions();
      const activePromotions = Array.isArray(promotions)
        ? promotions.filter(p => p.status === 'active')
        : [];

      const productsWithDiscounts = productsCache.data.map(product =>
        calculateProductDiscount(product, activePromotions)
      );

      return productsWithDiscounts;
    }

    // Build optimized query with fewer fields initially
    let query = supabase
      .from("products")
      .select(`
        id,
        name,
        description,
        price,
        image_url,
        stock_quantity,
        category_id,
        status,
        created_at,
        categories!inner (
          id,
          name
        )
      `)
      .eq("status", "active")
      .gt("stock_quantity", 0)
      .limit(100); // Add limit to improve performance

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    // Execute query with timeout and retry logic
    const productsPromise = query.order("name");
    const promotionsPromise = getPromotions();

    let products = null;
    let productsError = null;

    // Try the query with progressively longer timeouts
    for (const timeout of [3000, 6000, 10000]) {
      try {
        console.log(`Attempting products query with ${timeout}ms timeout...`);

        const [productsResult, promotions] = await Promise.allSettled([
          Promise.race([
            productsPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Products query timeout (${timeout}ms)`)), timeout)
            )
          ]) as Promise<any>,
          promotionsPromise
        ]);

        // Handle products result
        const queryResult = productsResult.status === 'fulfilled' ?
          productsResult.value :
          { data: null, error: productsResult.reason };

        if (queryResult.data) {
          products = queryResult.data;

          // Update cache
          productsCache = {
            data: products,
            timestamp: Date.now(),
            categoryId
          };

          console.log(`Successfully fetched ${products.length} products`);
          break; // Success, exit retry loop
        } else {
          productsError = queryResult.error;
          console.warn(`Query attempt failed with ${timeout}ms timeout:`, productsError);
        }

      } catch (attemptError) {
        console.warn(`Query attempt failed:`, attemptError);
        productsError = attemptError;
      }
    }

    // Handle promotions result
    const promotions = await getPromotions();
    const activePromotions = Array.isArray(promotions)
      ? promotions.filter(p => p.status === 'active')
      : [];

    if (!products) {
      console.error('All product query attempts failed:', productsError);

      // Return cached data if available, otherwise empty array
      if (productsCache && productsCache.data) {
        console.log('Using stale cached products due to query failure');
        const productsWithDiscounts = productsCache.data.map(product =>
          calculateProductDiscount(product, activePromotions)
        );
        return productsWithDiscounts;
      }

      return [];
    }
    
    // Calculate discounts for each product
    const productsWithDiscounts = products.map(product =>
      calculateProductDiscount(product, activePromotions)
    );

    return productsWithDiscounts;
  } catch (error) {
    console.error('Error fetching products with discounts:', error);

    // Return cached data if available, otherwise empty array
    if (productsCache && productsCache.data) {
      console.log('Using stale cached products due to error');
      try {
        const promotions = await getPromotions();
        const activePromotions = Array.isArray(promotions)
          ? promotions.filter(p => p.status === 'active')
          : [];

        const productsWithDiscounts = productsCache.data.map(product =>
          calculateProductDiscount(product, activePromotions)
        );
        return productsWithDiscounts;
      } catch {
        // If even promotions fail, return products without discounts
        return productsCache.data.map(product => ({ ...product, has_discount: false }));
      }
    }

    // Return empty array as final fallback
    return [];
  }
}

// Get a single product with discounts - Optimized
export async function getProductWithDiscounts(productId: string): Promise<ProductWithDiscount | null> {
  try {
    const productPromise = supabase
      .from("products")
      .select(`
        *,
        categories (
          id,
          name
        )
      `)
      .eq("id", productId)
      .eq("status", "active")
      .gt("stock_quantity", 0)
      .single();
    
    const promotionsPromise = getPromotions();
    
    // Parallel execution with improved timeout handling
    const [productResult, promotions] = await Promise.allSettled([
      Promise.race([
        productPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Product query timeout')), 4000)
        )
      ]) as Promise<any>,
      promotionsPromise // getPromotions now has its own timeout handling
    ]);

    // Handle product result
    const { data: product, error: productError } =
      productResult.status === 'fulfilled' ? productResult.value : { data: null, error: productResult.reason };

    if (productError) {
      console.error('Product query error:', productError);
      return null;
    }
    if (!product) return null;

    // Handle promotions result - getPromotions now handles its own errors/cache
    const activePromotions = promotions.status === 'fulfilled' && Array.isArray(promotions.value)
      ? promotions.value.filter(p => p.status === 'active')
      : [];
    
    // Calculate discounts for the product
    return calculateProductDiscount(product, activePromotions);
  } catch (error) {
    console.error('Error fetching product with discounts:', error);
    return null;
  }
}

// Validate promotion code - PRODUCTION READY
export async function validatePromotionCode(
  code: string, 
  orderAmount: number
): Promise<{ valid: boolean; promotion?: any; discount_amount?: number; error?: string }> {
  try {
    const { data: promotion, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("code", code)
      .eq("status", "active")
      .single();
    
    if (error) {
      return { valid: false, error: "Invalid promotion code" };
    }
    
    const currentDate = new Date();
    const validFrom = new Date(promotion.valid_from);
    const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;
    
    // Check if promotion is currently valid
    if (currentDate < validFrom) {
      return { valid: false, error: "Promotion not yet active" };
    }
    
    if (validUntil && currentDate > validUntil) {
      return { valid: false, error: "Promotion has expired" };
    }

    // PRODUCTION CRITICAL: Check if promotion is valid for current day
    if (!isPromotionValidForCurrentDay(promotion)) {
      const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      return { 
        valid: false, 
        error: `This promotion is not available on ${currentDay}` 
      };
    }
    
    // Check minimum order amount
    if (promotion.min_order_amount && orderAmount < promotion.min_order_amount) {
      return { 
        valid: false, 
        error: `Minimum order amount of ₦${promotion.min_order_amount} required` 
      };
    }
    
    // Check usage limit
    if (promotion.usage_limit && promotion.usage_count >= promotion.usage_limit) {
      return { valid: false, error: "Promotion usage limit reached" };
    }
    
    // Calculate discount amount
    let discountAmount = 0;
    
    switch (promotion.type) {
      case 'percentage':
        discountAmount = (orderAmount * promotion.value) / 100;
        if (promotion.max_discount_amount) {
          discountAmount = Math.min(discountAmount, promotion.max_discount_amount);
        }
        break;
      case 'fixed_amount':
        discountAmount = Math.min(promotion.value, orderAmount);
        break;
      case 'free_delivery':
        discountAmount = 0; // Handled separately in delivery fee calculation
        break;
      case 'buy_one_get_one':
        discountAmount = 0; // BOGO handled separately in cart logic
        break;
    }
    
    return { 
      valid: true, 
      promotion, 
      discount_amount: discountAmount 
    };
  } catch (error) {
    console.error('Error validating promotion code:', error);
    return { valid: false, error: "Error validating promotion code" };
  }
}
