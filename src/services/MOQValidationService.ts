import { supabase } from '@/integrations/supabase/client';

export interface MOQValidationError {
  type: 'moq_violation' | 'stock_insufficient' | 'product_not_found';
  productId: string;
  productName: string;
  currentQuantity: number;
  minimumRequired?: number;
  availableStock?: number;
  message: string;
}

export interface MOQValidationResponse {
  isValid: boolean;
  errors: MOQValidationError[];
  warnings: string[];
  pricingImpact?: {
    originalTotal: number;
    adjustedTotal: number;
    additionalCost: number;
    impactPercentage: number;
  };
}

export class MOQValidationService {
  /**
   * Validates cart items against product MOQ requirements
   */
  static async validateCartMOQ(cartItems: any[]): Promise<MOQValidationResponse> {
    try {
      if (!cartItems.length) {
        return {
          isValid: true,
          errors: [],
          warnings: []
        };
      }

      // Prepare order items for backend validation
      const orderItems = cartItems.map(item => ({
        product_id: item.product_id || item.id,
        quantity: item.quantity || 0
      }));

      // Call backend validation function
      const { data, error } = await supabase.rpc('validate_order_moq', {
        order_items: orderItems
      });

      if (error) {
        console.error('MOQ validation error:', error);
        // Fallback to frontend validation
        return this.fallbackValidation(cartItems);
      }

      // Get pricing impact
      const { data: pricingData } = await supabase.rpc('calculate_moq_pricing_impact', {
        order_items: orderItems
      });

      const validationResult = data as any;
      const pricingResult = pricingData as any;

      return {
        isValid: validationResult.is_valid,
        errors: (validationResult.violations || []).map((violation: any) => ({
          type: violation.type || 'moq_violation',
          productId: violation.product_id,
          productName: violation.product_name || 'Unknown Product',
          currentQuantity: violation.current_quantity || 0,
          minimumRequired: violation.minimum_required,
          message: this.getErrorMessage(violation)
        })),
        warnings: [],
        pricingImpact: pricingResult ? {
          originalTotal: pricingResult.original_total || 0,
          adjustedTotal: pricingResult.adjusted_total || 0,
          additionalCost: pricingResult.moq_impact || 0,
          impactPercentage: pricingResult.impact_percentage || 0
        } : undefined
      };

    } catch (error) {
      console.error('MOQ validation service error:', error);
      return this.fallbackValidation(cartItems);
    }
  }

  /**
   * Auto-adjusts quantities to meet MOQ requirements
   */
  static async autoAdjustForMOQ(cartItems: any[]): Promise<{
    adjustedItems: any[];
    adjustments: Array<{
      productId: string;
      productName: string;
      originalQuantity: number;
      adjustedQuantity: number;
      additionalCost: number;
    }>;
  }> {
    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.product_id || item.id,
        quantity: item.quantity || 0,
        price: item.price || 0,
        product_name: item.product_name || item.name
      }));

      const { data, error } = await supabase.rpc('adjust_quantities_for_moq', {
        order_items: orderItems
      });

      if (error) throw error;

      const adjustmentResult = data as any;

      return {
        adjustedItems: adjustmentResult.adjusted_items || [],
        adjustments: (adjustmentResult.adjustments_made || []).map((adj: any) => ({
          productId: adj.product_id,
          productName: adj.product_name,
          originalQuantity: adj.original_quantity,
          adjustedQuantity: adj.adjusted_quantity,
          additionalCost: (cartItems.find(item => 
            (item.product_id || item.id) === adj.product_id)?.price || 0) * 
            (adj.adjusted_quantity - adj.original_quantity)
        }))
      };

    } catch (error) {
      console.error('Auto adjustment failed:', error);
      return this.fallbackAutoAdjust(cartItems);
    }
  }

  /**
   * Checks if products have sufficient stock for MOQ
   */
  static async checkMOQStockAvailability(productIds: string[]): Promise<{
    [productId: string]: {
      isAvailable: boolean;
      moq: number;
      availableStock: number;
      isActive: boolean;
    }
  }> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, minimum_order_quantity, stock_quantity, status')
        .in('id', productIds);

      if (error) throw error;

      const result: any = {};
      
      data.forEach(product => {
        result[product.id] = {
          isAvailable: (product.stock_quantity || 0) >= (product.minimum_order_quantity || 1),
          moq: product.minimum_order_quantity || 1,
          availableStock: product.stock_quantity || 0,
          isActive: product.status === 'active'
        };
      });

      return result;

    } catch (error) {
      console.error('Failed to check MOQ stock availability:', error);
      return {};
    }
  }

  /**
   * Logs MOQ violations for analytics
   */
  static async logViolation(
    orderId: string,
    customerId: string,
    violations: MOQValidationError[],
    actionTaken: 'blocked' | 'adjusted' | 'override' = 'blocked'
  ): Promise<void> {
    try {
      await supabase.rpc('log_moq_violation', {
        p_order_id: orderId,
        p_customer_id: customerId,
        p_violations: violations as any,
        p_action_taken: actionTaken
      });
    } catch (error) {
      console.error('Failed to log MOQ violation:', error);
    }
  }

  /**
   * Fallback validation when backend is unavailable
   */
  private static fallbackValidation(cartItems: any[]): MOQValidationResponse {
    const errors: MOQValidationError[] = [];

    cartItems.forEach(item => {
      const moq = item.minimum_order_quantity || 1;
      const currentQuantity = item.quantity || 0;

      if (currentQuantity < moq) {
        errors.push({
          type: 'moq_violation',
          productId: item.product_id || item.id,
          productName: item.product_name || item.name || 'Unknown Product',
          currentQuantity,
          minimumRequired: moq,
          message: `${item.product_name || 'Product'} requires a minimum order of ${moq} items. You currently have ${currentQuantity}.`
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Fallback auto adjustment when backend is unavailable
   */
  private static fallbackAutoAdjust(cartItems: any[]): {
    adjustedItems: any[];
    adjustments: Array<{
      productId: string;
      productName: string;
      originalQuantity: number;
      adjustedQuantity: number;
      additionalCost: number;
    }>;
  } {
    const adjustedItems: any[] = [];
    const adjustments: any[] = [];

    cartItems.forEach(item => {
      const moq = item.minimum_order_quantity || 1;
      const currentQuantity = item.quantity || 0;

      if (currentQuantity < moq) {
        adjustedItems.push({
          ...item,
          quantity: moq,
          moq_adjusted: true,
          original_quantity: currentQuantity
        });

        adjustments.push({
          productId: item.product_id || item.id,
          productName: item.product_name || item.name,
          originalQuantity: currentQuantity,
          adjustedQuantity: moq,
          additionalCost: (item.price || 0) * (moq - currentQuantity)
        });
      } else {
        adjustedItems.push(item);
      }
    });

    return {
      adjustedItems,
      adjustments
    };
  }

  /**
   * Get user-friendly error message for violations
   */
  private static getErrorMessage(violation: any): string {
    switch (violation.type) {
      case 'not_found':
        return `Product not found: ${violation.product_id}`;
      case 'moq_violation':
        return `${violation.product_name || 'Product'} requires minimum ${violation.minimum_required} items. You have ${violation.current_quantity}.`;
      default:
        return `Validation error for ${violation.product_name || 'product'}`;
    }
  }

  /**
   * Get MOQ summary for admin dashboard
   */
  static async getMOQAnalytics(startDate?: string, endDate?: string): Promise<{
    totalViolations: number;
    topViolatedProducts: Array<{
      productId: string;
      productName: string;
      violationCount: number;
      revenueImpact: number;
    }>;
    actionBreakdown: {
      blocked: number;
      adjusted: number;
      override: number;
    };
  }> {
    try {
      // This would require additional RPC functions for analytics
      // For now, return mock data structure
      return {
        totalViolations: 0,
        topViolatedProducts: [],
        actionBreakdown: {
          blocked: 0,
          adjusted: 0,
          override: 0
        }
      };
    } catch (error) {
      console.error('Failed to get MOQ analytics:', error);
      return {
        totalViolations: 0,
        topViolatedProducts: [],
        actionBreakdown: {
          blocked: 0,
          adjusted: 0,
          override: 0
        }
      };
    }
  }
}