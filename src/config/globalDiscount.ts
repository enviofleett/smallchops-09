// Global discount configuration - applies 10% discount to all products
export const GLOBAL_DISCOUNT_CONFIG = {
  enabled: false,
  discountPercentage: 10,
  displayName: "Store-Wide Discount",
  badgeText: "10% OFF",
  description: "Save 10% on all products"
} as const;

/**
 * Apply global discount to a price
 * @param originalPrice - The original price before discount
 * @returns The discounted price rounded to 2 decimal places
 */
export const applyGlobalDiscount = (originalPrice: number): number => {
  if (!GLOBAL_DISCOUNT_CONFIG.enabled) {
    return originalPrice;
  }
  
  const discountMultiplier = 1 - (GLOBAL_DISCOUNT_CONFIG.discountPercentage / 100);
  return Math.round(originalPrice * discountMultiplier * 100) / 100;
};

/**
 * Calculate the discount amount saved
 * @param originalPrice - The original price before discount
 * @returns The amount saved by the discount
 */
export const calculateDiscountAmount = (originalPrice: number): number => {
  if (!GLOBAL_DISCOUNT_CONFIG.enabled) {
    return 0;
  }
  
  const discountedPrice = applyGlobalDiscount(originalPrice);
  return Math.round((originalPrice - discountedPrice) * 100) / 100;
};

/**
 * Check if global discount is currently active
 * @returns Boolean indicating if discount is enabled
 */
export const isGlobalDiscountActive = (): boolean => {
  return GLOBAL_DISCOUNT_CONFIG.enabled;
};
