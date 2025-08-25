import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface MOQValidationResult {
  isValid: boolean;
  violations: {
    productId: string;
    productName: string;
    currentQuantity: number;
    minimumRequired: number;
    shortfall: number;
    priceImpact?: number;
  }[];
  totalViolations: number;
  pricingImpact?: {
    originalTotal: number;
    adjustedTotal: number;
    additionalCost: number;
    impactPercentage: number;
  };
}

export interface MOQAdjustmentResult {
  adjustedItems: any[];
  adjustmentsMade: {
    productId: string;
    productName: string;
    originalQuantity: number;
    adjustedQuantity: number;
    additionalCost: number;
  }[];
  totalAdjustments: number;
}

export const useEnhancedMOQValidation = () => {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);

  const validateMOQWithPricing = async (cartItems: any[]): Promise<MOQValidationResult> => {
    setIsValidating(true);
    
    try {
      // Prepare order items for validation
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
        throw error;
      }

      // Calculate pricing impact
      const { data: pricingData } = await supabase.rpc('calculate_moq_pricing_impact', {
        order_items: orderItems
      });

      // Type cast the response data to avoid TypeScript errors
      const validationResult = data as any;
      const pricingResult = pricingData as any;

      const result: MOQValidationResult = {
        isValid: validationResult.is_valid,
        violations: (validationResult.violations || []).filter((v: any) => v.type === 'moq_violation'),
        totalViolations: validationResult.total_violations || 0,
        pricingImpact: pricingResult ? {
          originalTotal: pricingResult.original_total,
          adjustedTotal: pricingResult.adjusted_total,
          additionalCost: pricingResult.moq_impact,
          impactPercentage: pricingResult.impact_percentage
        } : undefined
      };

      return result;

    } catch (error: any) {
      console.error('Enhanced MOQ validation failed:', error);
      
      // Fallback to frontend validation
      return fallbackValidation(cartItems);
      
    } finally {
      setIsValidating(false);
    }
  };

  const fallbackValidation = (cartItems: any[]): MOQValidationResult => {
    const violations: MOQValidationResult['violations'] = [];

    cartItems.forEach(item => {
      const moq = item.minimum_order_quantity || 1;
      const currentQuantity = item.quantity || 0;

      if (currentQuantity < moq) {
        violations.push({
          productId: item.product_id || item.id,
          productName: item.product_name || item.name,
          currentQuantity,
          minimumRequired: moq,
          shortfall: moq - currentQuantity,
          priceImpact: (item.price || 0) * (moq - currentQuantity)
        });
      }
    });

    return {
      isValid: violations.length === 0,
      violations,
      totalViolations: violations.length
    };
  };

  const autoAdjustQuantities = async (cartItems: any[]): Promise<MOQAdjustmentResult> => {
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

      // Type cast the response data to avoid TypeScript errors
      const adjustmentResult = data as any;

      return {
        adjustedItems: adjustmentResult.adjusted_items || [],
        adjustmentsMade: (adjustmentResult.adjustments_made || []).map((adj: any) => ({
          ...adj,
          additionalCost: (cartItems.find(item => 
            (item.product_id || item.id) === adj.product_id)?.price || 0) * 
            (adj.adjusted_quantity - adj.original_quantity)
        })),
        totalAdjustments: adjustmentResult.total_adjustments || 0
      };

    } catch (error: any) {
      console.error('Auto adjustment failed:', error);
      
      // Fallback to frontend adjustment
      return fallbackAutoAdjust(cartItems);
    }
  };

  const fallbackAutoAdjust = (cartItems: any[]): MOQAdjustmentResult => {
    const adjustedItems: any[] = [];
    const adjustmentsMade: MOQAdjustmentResult['adjustmentsMade'] = [];

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

        adjustmentsMade.push({
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
      adjustmentsMade,
      totalAdjustments: adjustmentsMade.length
    };
  };

  const showMOQViolationDialog = (violations: MOQValidationResult['violations'], pricingImpact?: MOQValidationResult['pricingImpact']) => {
    if (violations.length === 1) {
      const violation = violations[0];
      const additionalCost = violation.priceImpact || 0;
      
      toast({
        title: "Minimum Order Quantity Not Met",
        description: `${violation.productName} requires minimum ${violation.minimumRequired} items. You have ${violation.currentQuantity}. ${additionalCost > 0 ? `Additional cost: ₦${additionalCost.toFixed(2)}` : ''}`,
        variant: "destructive",
        duration: 8000,
      });
    } else {
      const totalAdditionalCost = pricingImpact?.additionalCost || 0;
      
      toast({
        title: "Multiple MOQ Requirements Not Met",
        description: `${violations.length} products don't meet minimum quantities. ${totalAdditionalCost > 0 ? `Additional cost: ₦${totalAdditionalCost.toFixed(2)}` : ''}`,
        variant: "destructive",
        duration: 10000,
      });
    }
  };

  const showAdjustmentConfirmation = (adjustments: MOQAdjustmentResult['adjustmentsMade']) => {
    const totalAdditionalCost = adjustments.reduce((sum, adj) => sum + adj.additionalCost, 0);
    
    toast({
      title: "Quantities Adjusted for MOQ",
      description: `${adjustments.length} products adjusted to meet minimum requirements. Additional cost: ₦${totalAdditionalCost.toFixed(2)}`,
      variant: "default",
      duration: 6000,
    });
  };

  const logMOQViolation = async (orderId: string, customerId: string, violations: any[], actionTaken: string = 'blocked') => {
    try {
      await supabase.rpc('log_moq_violation', {
        p_order_id: orderId,
        p_customer_id: customerId,
        p_violations: violations,
        p_action_taken: actionTaken
      });
    } catch (error) {
      console.error('Failed to log MOQ violation:', error);
    }
  };

  const checkProductMOQAvailability = async (productIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, minimum_order_quantity, stock_quantity, status')
        .in('id', productIds);

      if (error) throw error;

      return data.map(product => ({
        ...product,
        moqAvailable: (product.stock_quantity || 0) >= (product.minimum_order_quantity || 1),
        isActive: product.status === 'active'
      }));

    } catch (error) {
      console.error('Failed to check MOQ availability:', error);
      return [];
    }
  };

  return {
    validateMOQWithPricing,
    autoAdjustQuantities,
    showMOQViolationDialog,
    showAdjustmentConfirmation,
    logMOQViolation,
    checkProductMOQAvailability,
    isValidating
  };
};