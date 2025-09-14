/**
 * Format price in Nigerian Naira
 */
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

/**
 * Calculate discount percentage
 */
export const calculateDiscountPercentage = (originalPrice: number, discountedPrice: number): number => {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
};