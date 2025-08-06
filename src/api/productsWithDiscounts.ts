import { supabase } from "@/integrations/supabase/client";
import { getPromotions } from "./promotions";
import { calculateProductDiscount, ProductWithDiscount } from "@/lib/discountCalculations";

// Get products with calculated discounts
export async function getProductsWithDiscounts(categoryId?: string): Promise<ProductWithDiscount[]> {
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
    }
    
    const { data: products, error: productsError } = await query.order("name");
    
    if (productsError) throw productsError;
    
    // Get active promotions
    const promotions = await getPromotions();
    const activePromotions = promotions.filter(p => p.status === 'active');
    
    // Calculate discounts for each product
    const productsWithDiscounts = (products || []).map(product => 
      calculateProductDiscount(product, activePromotions)
    );
    
    return productsWithDiscounts;
  } catch (error) {
    console.error('Error fetching products with discounts:', error);
    throw error;
  }
}

// Get a single product with discounts
export async function getProductWithDiscounts(productId: string): Promise<ProductWithDiscount | null> {
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
    
    if (productError) throw productError;
    if (!product) return null;
    
    // Get active promotions
    const promotions = await getPromotions();
    const activePromotions = promotions.filter(p => p.status === 'active');
    
    // Calculate discounts for the product
    return calculateProductDiscount(product, activePromotions);
  } catch (error) {
    console.error('Error fetching product with discounts:', error);
    return null;
  }
}

// Validate promotion code
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