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

export function calculateOrderDiscount(
  subtotal: number,
  promotions: Promotion[],
  promotionCode?: string
): { discount_amount: number; applied_promotion?: Promotion } {
  const currentDate = new Date();
  
  for (const promotion of promotions) {
    if (promotion.status !== 'active') continue;
    
    // If a code is provided, only apply that specific promotion
    if (promotionCode && promotion.code !== promotionCode) continue;
    
    const validFrom = new Date(promotion.valid_from);
    const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;
    
    // Check if promotion is currently valid
    if (currentDate < validFrom || (validUntil && currentDate > validUntil)) {
      continue;
    }
    
    // Check minimum order amount
    if (promotion.min_order_amount && subtotal < promotion.min_order_amount) {
      continue;
    }
    
    let discountAmount = 0;
    
    switch (promotion.type) {
      case 'percentage':
        discountAmount = (subtotal * promotion.value) / 100;
        if (promotion.max_discount_amount) {
          discountAmount = Math.min(discountAmount, promotion.max_discount_amount);
        }
        break;
      case 'fixed_amount':
        discountAmount = Math.min(promotion.value, subtotal);
        break;
      case 'free_delivery':
        // Handle this at the order level, not here
        break;
    }
    
    return { discount_amount: discountAmount, applied_promotion: promotion };
  }
  
  return { discount_amount: 0 };
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