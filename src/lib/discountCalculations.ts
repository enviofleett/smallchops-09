import { Promotion, PromotionType } from '@/api/promotions';

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
    value: number;
    valid_until?: string;
  };
  image_url?: string;
  category_id?: string;
  categories?: {
    id: string;
    name: string;
  };
  // BOGO specific fields
  is_bogo_eligible?: boolean;
  bogo_free_quantity?: number;
  bogo_paid_quantity?: number;
}

export interface CartPromotion {
  id: string;
  name: string;
  code?: string;
  type: PromotionType;
  discount_amount: number;
  free_delivery?: boolean;
  bogo_items?: Array<{
    product_id: string;
    product_name: string;
    paid_quantity: number;
    free_quantity: number;
    savings: number;
  }>;
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

export function calculateProductDiscount(
  product: any,
  promotions: Promotion[]
): ProductWithDiscount {
  let bestDiscount = 0;
  let bestPromotion: Promotion | null = null;
  
  const currentDate = new Date();
  
  // Find the best applicable promotion
  for (const promotion of promotions) {
    if (promotion.status !== 'active') continue;
    
    const validFrom = new Date(promotion.valid_from);
    const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;
    
    // Check if promotion is currently valid
    if (currentDate < validFrom || (validUntil && currentDate > validUntil)) {
      continue;
    }
    
    // Check if promotion applies to this product
    const appliesToProduct = 
      !promotion.applicable_products || 
      promotion.applicable_products.length === 0 || 
      promotion.applicable_products.includes(product.id);
    
    const appliesToCategory = 
      !promotion.applicable_categories || 
      promotion.applicable_categories.length === 0 || 
      (product.category_id && promotion.applicable_categories.includes(product.category_id));
    
    if (!appliesToProduct && !appliesToCategory) continue;
    
    let discountAmount = 0;
    
    switch (promotion.type) {
      case 'percentage':
        discountAmount = (product.price * promotion.value) / 100;
        if (promotion.max_discount_amount) {
          discountAmount = Math.min(discountAmount, promotion.max_discount_amount);
        }
        break;
      case 'fixed_amount':
        discountAmount = Math.min(promotion.value, product.price);
        break;
      case 'free_delivery':
        // This doesn't apply to individual products
        continue;
    }
    
    if (discountAmount > bestDiscount) {
      bestDiscount = discountAmount;
      bestPromotion = promotion;
    }
  }
  
  const original_price = product.price;
  const discounted_price = Math.max(0, original_price - bestDiscount);
  const discount_percentage = original_price > 0 ? (bestDiscount / original_price) * 100 : 0;
  
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: discounted_price, // This is the final price customers pay
    original_price,
    discounted_price,
    discount_amount: bestDiscount,
    discount_percentage,
    has_discount: bestDiscount > 0,
    active_promotion: bestPromotion ? {
      id: bestPromotion.id,
      name: bestPromotion.name,
      code: bestPromotion.code,
      type: bestPromotion.type,
      value: bestPromotion.value,
      valid_until: bestPromotion.valid_until,
    } : undefined,
    image_url: product.image_url,
    category_id: product.category_id,
    categories: product.categories,
  };
}

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
  const currentDate = new Date();
  const appliedPromotions: CartPromotion[] = [];
  let totalDiscount = 0;
  let deliveryDiscount = 0;
  const updatedCartItems = [...cartItems];

  // Sort promotions by priority (BOGO first, then percentage, then fixed, then free delivery)
  const sortedPromotions = [...promotions].sort((a, b) => {
    const priority: Record<PromotionType, number> = {
      'buy_one_get_one': 1,
      'percentage': 2,
      'fixed_amount': 3,
      'free_delivery': 4
    };
    return priority[a.type] - priority[b.type];
  });

  for (const promotion of sortedPromotions) {
    if (promotion.status !== 'active') continue;

    // If a code is provided, only apply that specific promotion
    if (promotionCode && promotion.code !== promotionCode) continue;

    const validFrom = new Date(promotion.valid_from);
    const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;

    // Check if promotion is currently valid
    if (currentDate < validFrom || (validUntil && currentDate > validUntil)) {
      continue;
    }

    // Check usage limits
    if (promotion.usage_limit && promotion.usage_count >= promotion.usage_limit) {
      continue;
    }

    // Check minimum order amount
    if (promotion.min_order_amount && subtotal < promotion.min_order_amount) {
      continue;
    }

    let promotionDiscount = 0;
    let bogoItems: CartPromotion['bogo_items'] = [];

    switch (promotion.type) {
      case 'buy_one_get_one':
        const bogoResult = calculateBogoDiscount(promotion, updatedCartItems);
        promotionDiscount = bogoResult.discount_amount;
        bogoItems = bogoResult.bogo_items;
        
        // Update cart items with BOGO info
        bogoResult.bogo_items?.forEach(bogoItem => {
          const cartItemIndex = updatedCartItems.findIndex(
            item => item.product_id === bogoItem.product_id
          );
          if (cartItemIndex !== -1) {
            updatedCartItems[cartItemIndex] = {
              ...updatedCartItems[cartItemIndex],
              is_bogo_eligible: true,
              bogo_free_quantity: bogoItem.free_quantity,
              bogo_paid_quantity: bogoItem.paid_quantity,
            } as any;
          }
        });
        break;

      case 'percentage':
        promotionDiscount = (subtotal * promotion.value) / 100;
        if (promotion.max_discount_amount) {
          promotionDiscount = Math.min(promotionDiscount, promotion.max_discount_amount);
        }
        break;

      case 'fixed_amount':
        promotionDiscount = Math.min(promotion.value, subtotal);
        break;

      case 'free_delivery':
        deliveryDiscount = deliveryFee;
        break;
    }

    if (promotionDiscount > 0 || deliveryDiscount > 0) {
      appliedPromotions.push({
        id: promotion.id,
        name: promotion.name,
        code: promotion.code,
        type: promotion.type,
        discount_amount: promotionDiscount,
        free_delivery: promotion.type === 'free_delivery',
        bogo_items: bogoItems.length > 0 ? bogoItems : undefined,
      });

      totalDiscount += promotionDiscount;
      
      // For now, only apply the first valid promotion to prevent stacking
      // In production, you might want more sophisticated stacking rules
      break;
    }
  }

  return {
    total_discount: totalDiscount,
    delivery_discount: deliveryDiscount,
    applied_promotions: appliedPromotions,
    updated_cart_items: updatedCartItems,
  };
}

function calculateBogoDiscount(
  promotion: Promotion,
  cartItems: Array<{
    id: string;
    product_id: string;
    product_name: string;
    price: number;
    quantity: number;
    category_id?: string;
  }>
): {
  discount_amount: number;
  bogo_items: Array<{
    product_id: string;
    product_name: string;
    paid_quantity: number;
    free_quantity: number;
    savings: number;
  }>;
} {
  let totalDiscount = 0;
  const bogoItems: any[] = [];

  for (const item of cartItems) {
    // Check if item is eligible for this BOGO promotion
    const isEligible = 
      !promotion.applicable_products ||
      promotion.applicable_products.length === 0 ||
      promotion.applicable_products.includes(item.product_id) ||
      (item.category_id && promotion.applicable_categories?.includes(item.category_id));

    if (isEligible && item.quantity >= 2) {
      // Simple BOGO logic: for every 2 items, get 1 free
      const freeQuantity = Math.floor(item.quantity / 2);
      const paidQuantity = item.quantity - freeQuantity;
      const savings = freeQuantity * item.price;

      if (freeQuantity > 0) {
        totalDiscount += savings;
        bogoItems.push({
          product_id: item.product_id,
          product_name: item.product_name,
          paid_quantity: paidQuantity,
          free_quantity: freeQuantity,
          savings,
        });
      }
    }
  }

  return { discount_amount: totalDiscount, bogo_items: bogoItems };
}

// Legacy function for backward compatibility
export function calculateOrderDiscount(
  subtotal: number,
  promotions: Promotion[],
  promotionCode?: string
): { discount_amount: number; applied_promotion?: Promotion } {
  const result = calculateAdvancedOrderDiscount(
    [],
    subtotal,
    0,
    promotions,
    promotionCode
  );
  
  return {
    discount_amount: result.total_discount,
    applied_promotion: result.applied_promotions[0] ? {
      id: result.applied_promotions[0].id,
      name: result.applied_promotions[0].name,
      description: '', // Not available in new structure
      code: result.applied_promotions[0].code || '',
      type: result.applied_promotions[0].type,
      value: 0, // Not directly available in new structure
      min_order_amount: 0,
      max_discount_amount: null,
      usage_limit: null,
      usage_count: 0,
      status: 'active' as const,
      valid_from: new Date().toISOString(),
      valid_until: null,
      applicable_categories: [],
      applicable_products: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null,
    } : undefined,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDiscount(discountPercentage: number): string {
  return `${Math.round(discountPercentage)}% OFF`;
}