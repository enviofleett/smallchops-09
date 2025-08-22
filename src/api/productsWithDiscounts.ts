import { supabase } from "@/integrations/supabase/client";
import { getPromotions } from "./promotions";
import { calculateProductDiscount, ProductWithDiscount, isPromotionValidForCurrentDay } from "@/lib/discountCalculations";

// Get products with calculated discounts - Production Ready
export async function getProductsWithDiscounts(categoryId?: string): Promise<ProductWithDiscount[]> {
  console.log('🔍 Fetching products with discounts:', { categoryId });
  
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
  }
  
  try {
    // Execute products query - let React Query handle retries
    const { data: products, error: productsError } = await query.order("name");
    
    if (productsError) {
      console.error('❌ Products query error:', productsError);
      throw new Error(`Products fetch failed: ${productsError.message}`);
    }
    
    if (!products || products.length === 0) {
      console.log('📦 No products found for category:', categoryId);
      return [];
    }
    
    console.log('✅ Products fetched successfully:', products.length);
    
    // Fetch promotions - non-fatal, default to empty array on failure
    let activePromotions: any[] = [];
    try {
      const promotions = await getPromotions();
      activePromotions = Array.isArray(promotions) 
        ? promotions.filter(p => p.status === 'active')
        : [];
      console.log('✅ Promotions fetched successfully:', activePromotions.length);
    } catch (promotionsError) {
      console.warn('⚠️ Promotions fetch failed (non-fatal):', promotionsError);
      // Continue without promotions - products will have no discounts
    }
    
    // Calculate discounts for each product
    const productsWithDiscounts = products.map(product => 
      calculateProductDiscount(product, activePromotions)
    );
    
    console.log('✅ Products with discounts calculated:', {
      total: productsWithDiscounts.length,
      withDiscounts: productsWithDiscounts.filter(p => p.has_discount).length
    });
    
    return productsWithDiscounts;
  } catch (error) {
    console.error('❌ Error fetching products with discounts:', error);
    // Re-throw error to let React Query handle retries properly
    throw error;
  }
}

// Get a single product with discounts - Production Ready
export async function getProductWithDiscounts(productId: string): Promise<ProductWithDiscount | null> {
  console.log('🔍 Fetching single product with discounts:', { productId });
  
  try {
    const { data: product, error: productError } = await supabase
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
    
    if (productError) {
      console.error('❌ Product query error:', productError);
      return null;
    }
    if (!product) {
      console.log('📦 Product not found:', productId);
      return null;
    }
    
    console.log('✅ Product fetched successfully:', product.name);
    
    // Fetch promotions - non-fatal
    let activePromotions: any[] = [];
    try {
      const promotions = await getPromotions();
      activePromotions = Array.isArray(promotions) 
        ? promotions.filter(p => p.status === 'active')
        : [];
      console.log('✅ Promotions fetched for single product:', activePromotions.length);
    } catch (promotionsError) {
      console.warn('⚠️ Promotions fetch failed for single product (non-fatal):', promotionsError);
    }
    
    // Calculate discounts for the product
    const productWithDiscount = calculateProductDiscount(product, activePromotions);
    console.log('✅ Single product with discount calculated:', {
      name: productWithDiscount.name,
      hasDiscount: productWithDiscount.has_discount
    });
    
    return productWithDiscount;
  } catch (error) {
    console.error('❌ Error fetching single product with discounts:', error);
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