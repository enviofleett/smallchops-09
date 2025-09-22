import { Promotion, PromotionType } from '@/api/promotions';

// Simplified interfaces for production-ready promotion system
export interface ProductWithDiscount {
  id: string;
  name: string;
  description?: string;
  price: number;
  original_price: number;
  discounted_price: number;
  discount_amount: number;
  discount_percentage: number;
  has_discount: boolean;
  active_promotion?: {
    id: string;
    name: string;
    code?: string;
    type: PromotionType;
    value: number | null;
    valid_until?: string;
  };
  image_url?: string;
  category_id?: string;
  categories?: {
    id: string;
    name: string;
  };
  features?: string[];
  stock_quantity?: number;
  preparation_time?: number;
  minimum_order_quantity?: number;
}

export interface CartPromotion {
  id: string;
  name: string;
  code?: string;
  type: PromotionType | 'buy_one_get_one'; // Add BOGO support
  discount_amount: number;
  free_delivery?: boolean;
  min_order_amount?: number; // Add minimum order amount field
}

export interface DiscountInfo {
  original_price: number;
  discounted_price: number;
  discount_amount: number;
  discount_percentage: number;
  savings: number;
  promotion_name?: string;
  promotion_code?: string;
}

/**
 * Simplified promotion validation - checks basic eligibility
 */
export function isPromotionValid(promotion: Promotion): boolean {
  try {
    // Check if promotion is active
    if (promotion.status !== 'active') {
      return false;
    }

    // Check date validity
    const now = new Date();
    const validFrom = new Date(promotion.valid_from);
    const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;

    if (now < validFrom || (validUntil && now > validUntil)) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Error validating promotion:', error);
    return false;
  }
}

/**
 * Simplified function to get the best applicable promotion for an order
 */
export function getBestPromotion(
  subtotal: number,
  deliveryFee: number,
  promotions: Promotion[],
  promotionCode?: string
): {
  bestPromotion: Promotion | null;
  discount: number;
  deliveryDiscount: number;
} {
  let bestPromotion: Promotion | null = null;
  let maxDiscount = 0;
  let deliveryDiscount = 0;

  const validPromotions = promotions.filter(promotion => {
    // Basic validation
    if (!isPromotionValid(promotion)) return false;

    // If code is provided, only consider that specific promotion
    if (promotionCode && promotion.code !== promotionCode) return false;

    // Check minimum order requirement
    if (promotion.min_order_amount && subtotal < promotion.min_order_amount) return false;

    return true;
  });

  for (const promotion of validPromotions) {
    let currentDiscount = 0;
    let currentDeliveryDiscount = 0;

    switch (promotion.type) {
      case 'percentage':
        if (promotion.value !== null) {
          currentDiscount = (subtotal * promotion.value) / 100;
        }
        break;

      case 'fixed_amount':
        if (promotion.value !== null) {
          currentDiscount = Math.min(promotion.value, subtotal);
        }
        break;

      case 'free_delivery':
        currentDeliveryDiscount = deliveryFee;
        break;
    }

    // Calculate total savings (discount + delivery savings)
    const totalSavings = currentDiscount + currentDeliveryDiscount;

    if (totalSavings > maxDiscount) {
      maxDiscount = totalSavings;
      bestPromotion = promotion;
      deliveryDiscount = currentDeliveryDiscount;
    }
  }

  return {
    bestPromotion,
    discount: bestPromotion && bestPromotion.type !== 'free_delivery' ? maxDiscount : 0,
    deliveryDiscount,
  };
}

/**
 * Apply the best promotion to an order
 */
export function calculateOrderDiscount(
  subtotal: number,
  deliveryFee: number,
  promotions: Promotion[],
  promotionCode?: string
): {
  total_discount: number;
  delivery_discount: number;
  applied_promotion: CartPromotion | null;
} {
  const { bestPromotion, discount, deliveryDiscount } = getBestPromotion(
    subtotal,
    deliveryFee,
    promotions,
    promotionCode
  );

  if (!bestPromotion) {
    return {
      total_discount: 0,
      delivery_discount: 0,
      applied_promotion: null,
    };
  }

  return {
    total_discount: discount,
    delivery_discount: deliveryDiscount,
    applied_promotion: {
      id: bestPromotion.id,
      name: bestPromotion.name,
      code: bestPromotion.code,
      type: bestPromotion.type,
      discount_amount: discount,
      free_delivery: bestPromotion.type === 'free_delivery',
    },
  };
}

/**
 * Legacy compatibility function
 */
export function calculateAdvancedOrderDiscount(
  cartItems: Array<{
    id: string;
    product_id: string;
    product_name: string;
    price: number;
    quantity: number;
    category_id?: string;
  }>,
  subtotal: number,
  deliveryFee: number,
  promotions: Promotion[],
  promotionCode?: string
): {
  total_discount: number;
  delivery_discount: number;
  applied_promotions: CartPromotion[];
  updated_cart_items: Array<any>;
} {
  const result = calculateOrderDiscount(subtotal, deliveryFee, promotions, promotionCode);
  
  return {
    total_discount: result.total_discount,
    delivery_discount: result.delivery_discount,
    applied_promotions: result.applied_promotion ? [result.applied_promotion] : [],
    updated_cart_items: cartItems, // No modifications needed in simplified version
  };
}

/**
 * Simplified product discount calculation - no longer supports product-specific promotions
 * Products get discounted through cart-level promotions only
 */
export function calculateProductDiscount(
  product: any,
  promotions: Promotion[]
): ProductWithDiscount {
  // In simplified version, products don't get individual discounts
  // All discounts are applied at cart level
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    original_price: product.price,
    discounted_price: product.price,
    discount_amount: 0,
    discount_percentage: 0,
    has_discount: false,
    active_promotion: undefined,
    image_url: product.image_url,
    category_id: product.category_id,
    categories: product.categories,
    features: product.features,
    stock_quantity: product.stock_quantity,
    preparation_time: product.preparation_time,
    minimum_order_quantity: product.minimum_order_quantity,
  };
}

/**
 * Format currency amount as Nigerian Naira
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format discount percentage for display
 */
export function formatDiscount(discountPercentage: number): string {
  return `${Math.round(discountPercentage)}% OFF`;
}

/**
 * Legacy function - no longer needed in simplified system
 * All promotions are valid all days in the simplified version
 */
export function isPromotionValidForCurrentDay(promotion: Promotion): boolean {
  // In simplified system, all promotions are valid all days
  // This function is kept for backward compatibility
  return true;
}