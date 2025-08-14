import { supabase } from "@/integrations/supabase/client";
import { getPromotions } from "./promotions";
import { calculateProductDiscount, ProductWithDiscount, isPromotionValidForCurrentDay } from "@/lib/discountCalculations";

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

// Validate promotion code - PRODUCTION READY
export async function validatePromotionCode(
  code: string, 
  orderAmount: number
): Promise<{ 
  valid: boolean; 
  promotion?: any; 
  discount_amount?: number; 
  error?: string;
  errorCode?: string;
}> {
  try {
    // Input validation
    if (!code || code.trim().length === 0) {
      return { 
        valid: false, 
        error: "Please enter a promotion code",
        errorCode: "EMPTY_CODE"
      };
    }

    if (orderAmount <= 0) {
      return { 
        valid: false, 
        error: "Your cart is empty. Add items before applying a promotion.",
        errorCode: "CART_EMPTY"
      };
    }

    const { data: promotion, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .single();
    
    if (error || !promotion) {
      return { 
        valid: false, 
        error: "The promotion code you entered is not valid. Please check the code and try again.",
        errorCode: "PROMOTION_NOT_FOUND"
      };
    }

    // Check status
    if (promotion.status !== "active") {
      return { 
        valid: false, 
        error: "This promotion is currently inactive. Please contact support if you believe this is an error.",
        errorCode: "PROMOTION_INACTIVE"
      };
    }
    
    // Check date validity
    const currentDate = new Date();
    const validFrom = promotion.valid_from ? new Date(promotion.valid_from) : null;
    const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;
    
    if (validFrom && currentDate < validFrom) {
      return { 
        valid: false, 
        error: `This promotion will be available starting ${validFrom.toLocaleDateString()}`,
        errorCode: "PROMOTION_NOT_STARTED"
      };
    }
    
    if (validUntil && currentDate > validUntil) {
      return { 
        valid: false, 
        error: "This promotion has expired. Please check for current offers.",
        errorCode: "PROMOTION_EXPIRED"
      };
    }

    // Check day of week applicability
    if (!isPromotionValidForCurrentDay(promotion)) {
      const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const validDays = promotion.applicable_days?.join(', ') || 'specific days';
      return { 
        valid: false, 
        error: `This promotion is only valid on ${validDays}. Today is ${currentDay}.`,
        errorCode: "PROMOTION_NOT_APPLICABLE_TODAY"
      };
    }
    
    // Check minimum order amount
    if (promotion.min_order_amount && orderAmount < promotion.min_order_amount) {
      const required = promotion.min_order_amount;
      const shortfall = required - orderAmount;
      return { 
        valid: false, 
        error: `Add ₦${shortfall.toFixed(2)} more to your order. Minimum required: ₦${required} (Current: ₦${orderAmount.toFixed(2)})`,
        errorCode: "MINIMUM_ORDER_NOT_MET"
      };
    }
    
    // Check usage limit
    if (promotion.usage_limit && promotion.usage_count >= promotion.usage_limit) {
      return { 
        valid: false, 
        error: "This promotion has reached its usage limit and is no longer available.",
        errorCode: "USAGE_LIMIT_REACHED"
      };
    }
    
    // Calculate discount amount
    let discountAmount = 0;
    
    switch (promotion.type) {
      case 'percentage':
        discountAmount = (orderAmount * promotion.value) / 100;
        if (promotion.max_discount_amount) {
          discountAmount = Math.min(discountAmount, promotion.max_discount_amount);
        }
        discountAmount = Math.min(discountAmount, orderAmount); // Can't discount more than order total
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
      default:
        return { 
          valid: false, 
          error: "Invalid promotion type",
          errorCode: "INVALID_PROMOTION_TYPE"
        };
    }
    
    return { 
      valid: true, 
      promotion, 
      discount_amount: Math.round(discountAmount * 100) / 100 // Round to 2 decimal places
    };
  } catch (error) {
    console.error('Error validating promotion code:', error);
    return { 
      valid: false, 
      error: "Unable to validate promotion. Please try again or contact support.",
      errorCode: "VALIDATION_ERROR"
    };
  }
}