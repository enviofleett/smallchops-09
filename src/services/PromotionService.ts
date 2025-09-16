import { toast } from '@/hooks/use-toast';
import { isPromotionValidForCurrentDay } from '@/lib/discountCalculations';
import type { Promotion } from '@/api/promotions';

// Production-ready promotion service with error handling
export class PromotionService {
  static validatePromotion(promotion: Promotion): boolean {
    try {
      // Check if promotion is active
      if (promotion.status !== 'active') {
        return false;
      }

      // Check date validity
      const now = new Date();
      if (promotion.valid_from && new Date(promotion.valid_from) > now) {
        return false;
      }
      if (promotion.valid_until && new Date(promotion.valid_until) < now) {
        return false;
      }

      // Check day validity
      return isPromotionValidForCurrentDay(promotion);
    } catch (error) {
      console.error('Promotion validation error:', error);
      return false;
    }
  }

  static async applyPromotion(promotion: Promotion, orderTotal: number): Promise<number> {
    try {
      if (!this.validatePromotion(promotion)) {
        throw new Error('Promotion is not valid');
      }

      // Check minimum order amount
      if (promotion.min_order_amount && orderTotal < promotion.min_order_amount) {
        throw new Error(`Minimum order amount of ₦${promotion.min_order_amount} required`);
      }

      let discount = 0;

      switch (promotion.type) {
        case 'percentage':
          discount = (orderTotal * (promotion.value || 0)) / 100;
          if (promotion.max_discount_amount && discount > promotion.max_discount_amount) {
            discount = promotion.max_discount_amount;
          }
          break;

        case 'fixed_amount':
          discount = Math.min(promotion.value || 0, orderTotal);
          break;

        case 'free_delivery':
          // Return a flag value for free delivery
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

  static getPromotionDisplayText(promotion: Promotion): string {
    try {
      switch (promotion.type) {
        case 'percentage':
          return `${promotion.value}% OFF`;
        case 'fixed_amount':
          return `₦${promotion.value} OFF`;
        case 'buy_one_get_one':
          return 'BOGO';
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
}