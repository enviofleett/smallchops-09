import { supabase } from "@/integrations/supabase/client";
import { getPromotions } from "./promotions";
import { calculateProductDiscount, ProductWithDiscount, isPromotionValidForCurrentDay } from "@/lib/discountCalculations";

// Get products with calculated discounts - Optimized for faster loading
export async function getProductsWithDiscounts(categoryId?: string): Promise<ProductWithDiscount[]> {
  console.log('🔍 [getProductsWithDiscounts] Called with categoryId:', categoryId);
  try {
    // Build the query
    let query = supabase
      .from("products")
      .select(`
        *,
        categories (
          id,
          name
        )
      `)
      .eq("status", "active")
      .gt("stock_quantity", 0);
    
    if (categoryId) {
      query = query.eq("category_id", categoryId);
      console.log('🔍 [getProductsWithDiscounts] Applied category filter:', categoryId);
    } else {
      console.log('🔍 [getProductsWithDiscounts] No category filter applied (all products)');
    }
    
    // Execute query with increased timeout for better reliability
    const productsPromise = query.order("name");
    const promotionsPromise = getPromotions();
    
    // Use Promise.allSettled to handle promotions failure gracefully
    const [
      productsResult,
      promotionsResult
    ] = await Promise.allSettled([
      Promise.race([
        productsPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Products query timeout')), 8000) // Increased timeout
        )
      ]) as Promise<any>,
      Promise.race([
        promotionsPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Promotions query timeout')), 3000) // Increased timeout
        )
      ]) as Promise<any>
    ]);
    
    // Handle products result
    if (productsResult.status === 'rejected') {
      console.error('Products query failed:', productsResult.reason);
      return [];
    }
    
    const { data: products, error: productsError } = productsResult.value;
    if (productsError) {
      console.error('Products query error:', productsError);
      return [];
    }
    
    // Handle promotions gracefully - don't fail if promotions can't be loaded
    let activePromotions = [];
    if (promotionsResult.status === 'fulfilled') {
      const promotions = promotionsResult.value;
      activePromotions = Array.isArray(promotions) 
        ? promotions.filter(p => p.status === 'active')
        : [];
    } else {
      console.warn('Promotions query failed, continuing without promotions:', promotionsResult.reason);
    }
    
    // Calculate discounts for each product
    const productsWithDiscounts = (products || []).map(product => 
      calculateProductDiscount(product, activePromotions)
    );
    
    console.log('🔍 [getProductsWithDiscounts] Returning', productsWithDiscounts.length, 'products');
    return productsWithDiscounts;
  } catch (error) {
    console.error('Error fetching products with discounts:', error);
    console.error('CategoryId:', categoryId);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    // Return empty array on error to prevent complete page failure
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
    
    // Parallel execution with timeout
    const [
      { data: product, error: productError },
      promotions
    ] = await Promise.all([
      Promise.race([
        productPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Product query timeout')), 3000)
        )
      ]) as Promise<any>,
      Promise.race([
        promotionsPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Promotions query timeout')), 2000)
        )
      ]) as Promise<any>
    ]);
    
    if (productError) {
      console.error('Product query error:', productError);
      return null;
    }
    if (!product) return null;
    
    // Safely handle promotions error
    const activePromotions = Array.isArray(promotions) 
      ? promotions.filter(p => p.status === 'active')
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