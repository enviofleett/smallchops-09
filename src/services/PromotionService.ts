import { toast } from '@/hooks/use-toast';
import { isPromotionValid } from '@/lib/discountCalculations';
import type { Promotion } from '@/api/promotions';

/**
 * Production-ready promotion service with simplified logic
 */
export class PromotionService {
  /**
   * Validate if a promotion can be applied
   */
  static validatePromotion(promotion: Promotion): boolean {
    try {
      return isPromotionValid(promotion);
    } catch (error) {
      console.error('Promotion validation error:', error);
      return false;
    }
  }

  /**
   * Apply a promotion to an order and return the discount amount
   */
  static async applyPromotion(promotion: Promotion, orderTotal: number): Promise<number> {
    try {
      if (!this.validatePromotion(promotion)) {
        throw new Error('Promotion is not valid');
      }

      // Check minimum order amount
      if (promotion.min_order_amount && orderTotal < promotion.min_order_amount) {
        throw new Error(`Minimum order amount of ₦${promotion.min_order_amount.toLocaleString()} required`);
      }

      let discount = 0;

      switch (promotion.type) {
        case 'percentage':
          if (promotion.value !== null) {
            discount = (orderTotal * promotion.value) / 100;
          }
          break;

        case 'fixed_amount':
          if (promotion.value !== null) {
            discount = Math.min(promotion.value, orderTotal);
          }
          break;

        case 'free_delivery':
          // Return a special flag for free delivery
          discount = -1;
          break;

        default:
          discount = 0;
      }

      return Math.max(0, discount);
    } catch (error) {
      console.error('Error applying promotion:', error);
      toast({
        title: 'Promotion Error',
        description: error instanceof Error ? error.message : 'Failed to apply promotion',
        variant: 'destructive'
      });
      return 0;
    }
  }

  /**
   * Get display text for a promotion
   */
  static getPromotionDisplayText(promotion: Promotion): string {
    try {
      switch (promotion.type) {
        case 'percentage':
          return promotion.value ? `${promotion.value}% OFF` : 'DISCOUNT';
        case 'fixed_amount':
          return promotion.value ? `₦${promotion.value.toLocaleString()} OFF` : 'DISCOUNT';
        case 'free_delivery':
          return 'FREE DELIVERY';
        default:
          return 'DISCOUNT';
      }
    } catch (error) {
      console.error('Error getting promotion display text:', error);
      return 'DISCOUNT';
    }
  }

  /**
   * Get promotion description including minimum order requirement
   */
  static getPromotionDescription(promotion: Promotion): string {
    try {
      let description = this.getPromotionDisplayText(promotion);
      
      if (promotion.min_order_amount && promotion.min_order_amount > 0) {
        description += ` on orders ₦${promotion.min_order_amount.toLocaleString()}+`;
      }

      return description;
    } catch (error) {
      console.error('Error getting promotion description:', error);
      return 'DISCOUNT';
    }
  }

  /**
   * Check if a promotion code is valid and active
   */
  static isPromotionCodeValid(promotions: Promotion[], code: string): Promotion | null {
    if (!code?.trim()) return null;

    const promotion = promotions.find(p => 
      p.code?.toUpperCase() === code.toUpperCase() && 
      this.validatePromotion(p)
    );

    return promotion || null;
  }

  /**
   * Get all currently valid promotions (no code required)
   */
  static getValidAutomaticPromotions(promotions: Promotion[]): Promotion[] {
    return promotions.filter(promotion => 
      this.validatePromotion(promotion) && !promotion.code
    );
  }
}