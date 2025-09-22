// Centralized Order Calculation Service
// Implements senior engineer's recommendations for fixing order total mismatch

import { logger } from '@/lib/logger';

// ============= CONSTANTS =============
const CALCULATION_TOLERANCE = 0.01; // 1 cent tolerance for floating point precision
const VAT_RATE_DEFAULT = 7.5; // Default VAT rate percentage

// ============= INTERFACES =============
export interface CalculationItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number; // Price in Naira (will be converted to cents internally)
  quantity: number;
  vat_rate?: number;
}

export interface PromotionCalculation {
  id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_delivery';
  value: number; // Changed from discount_amount to match server field
  discount_amount?: number; // Keep for backward compatibility
  free_delivery: boolean;
}

export interface OrderCalculationResult {
  // All amounts in Naira (converted from cents)
  subtotal: number;
  subtotal_cost: number; // Pre-VAT amount
  total_vat: number;
  delivery_fee: number;
  discount_amount: number;
  delivery_discount: number;
  total_amount: number;
  applied_promotions: PromotionCalculation[];
  
  // Debug information
  calculation_breakdown: {
    subtotal_cents: number;
    delivery_fee_cents: number;
    discount_cents: number;
    total_cents: number;
    precision_adjustments: number;
  };
}

export interface OrderCalculationInput {
  items: CalculationItem[];
  delivery_fee?: number;
  promotions?: PromotionCalculation[];
  promotion_code?: string;
  calculation_source: 'client' | 'server';
}

// ============= UTILITY FUNCTIONS =============

/**
 * Convert Naira to cents (integer arithmetic)
 * Eliminates floating point precision issues
 */
function toCents(naira: number): number {
  return Math.round(naira * 100);
}

/**
 * Convert cents back to Naira
 * Always returns 2 decimal places
 */
function toNaira(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Standardized rounding for currency
 * Ensures consistent rounding across client and server
 */
function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Calculate VAT breakdown using integer arithmetic
 */
function calculateVATBreakdown(priceInNaira: number, vatRate: number = VAT_RATE_DEFAULT) {
  const totalPriceCents = toCents(priceInNaira);
  const vatRateDecimal = vatRate / 100;
  
  // Calculate pre-VAT cost using integer math
  const costPriceCents = Math.round(totalPriceCents / (1 + vatRateDecimal));
  const vatAmountCents = totalPriceCents - costPriceCents;
  
  return {
    cost_price: toNaira(costPriceCents),
    vat_amount: toNaira(vatAmountCents),
    total_price: toNaira(totalPriceCents),
    vat_rate: vatRate
  };
}

// ============= MAIN CALCULATION SERVICE =============

export class OrderCalculationService {
  /**
   * Calculate complete order totals with detailed logging (ENHANCED)
   * Uses integer arithmetic to prevent floating point issues
   */
  static calculateOrder(input: OrderCalculationInput): OrderCalculationResult {
    const startTime = performance.now();
    
    logger.info(`🔢 Order calculation starting (${input.calculation_source})`, {
      itemCount: input.items.length,
      deliveryFee: input.delivery_fee,
      promotionCode: input.promotion_code,
      promotions: input.promotions?.length || 0
    });

    try {
      // Step 1: Calculate subtotal using integer arithmetic
      let subtotalCents = 0;
      let subtotalCostCents = 0;
      let totalVatCents = 0;
      
      const itemBreakdowns = input.items.map(item => {
        const itemPriceCents = toCents(item.price);
        const itemTotalCents = itemPriceCents * item.quantity;
        
        // Calculate VAT breakdown for this item
        const vatBreakdown = calculateVATBreakdown(item.price, item.vat_rate || VAT_RATE_DEFAULT);
        const itemCostCents = toCents(vatBreakdown.cost_price) * item.quantity;
        const itemVatCents = toCents(vatBreakdown.vat_amount) * item.quantity;
        
        subtotalCents += itemTotalCents;
        subtotalCostCents += itemCostCents;
        totalVatCents += itemVatCents;
        
        logger.debug(`Item calculation: ${item.product_name} - ${item.quantity} x ₦${item.price} = ${itemTotalCents} cents`);
        
        return {
          ...item,
          unit_price_cents: itemPriceCents,
          unit_cost_cents: toCents(vatBreakdown.cost_price),
          unit_vat_cents: toCents(vatBreakdown.vat_amount),
          total_price_cents: itemTotalCents,
          total_cost_cents: itemCostCents,
          total_vat_cents: itemVatCents
        };
      });

      logger.info(`✅ Subtotal calculated: ${subtotalCents} cents (₦${toNaira(subtotalCents)})`);

      // Step 2: Calculate delivery fee
      const deliveryFeeCents = toCents(input.delivery_fee || 0);
      logger.info(`🚚 Delivery fee: ${deliveryFeeCents} cents (₦${toNaira(deliveryFeeCents)})`);
      
      // Step 3: Apply promotions
      const promotionResult = this.calculatePromotions(
        subtotalCents,
        deliveryFeeCents,
        input.promotions || [],
        input.promotion_code
      );
      
      logger.info(`🎟️ Promotions applied: discount=${promotionResult.discountCents} cents, delivery_discount=${promotionResult.deliveryDiscountCents} cents`);
      
      // Step 4: Calculate final totals
      const finalTotalCents = subtotalCents + deliveryFeeCents - promotionResult.discountCents - promotionResult.deliveryDiscountCents;
      
      // Step 5: Convert back to Naira
      const result: OrderCalculationResult = {
        subtotal: toNaira(subtotalCents),
        subtotal_cost: toNaira(subtotalCostCents),
        total_vat: toNaira(totalVatCents),
        delivery_fee: toNaira(deliveryFeeCents),
        discount_amount: toNaira(promotionResult.discountCents),
        delivery_discount: toNaira(promotionResult.deliveryDiscountCents),
        total_amount: toNaira(finalTotalCents),
        applied_promotions: promotionResult.appliedPromotions,
        calculation_breakdown: {
          subtotal_cents: subtotalCents,
          delivery_fee_cents: deliveryFeeCents,
          discount_cents: promotionResult.discountCents,
          total_cents: finalTotalCents,
          precision_adjustments: 0 // Track any rounding adjustments
        }
      };

      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      // Enhanced detailed logging for debugging mismatches
      logger.info(`✅ Order calculation completed (${input.calculation_source})`, {
        calculationTimeMs: Math.round(calculationTime * 100) / 100,
        finalTotals: {
          subtotal: result.subtotal,
          deliveryFee: result.delivery_fee,
          discountAmount: result.discount_amount,
          deliveryDiscount: result.delivery_discount,
          totalAmount: result.total_amount
        },
        centuAnalysis: {
          subtotal_cents: subtotalCents,
          delivery_fee_cents: deliveryFeeCents,
          discount_cents: promotionResult.discountCents,
          delivery_discount_cents: promotionResult.deliveryDiscountCents,
          total_cents: finalTotalCents
        },
        appliedPromotions: promotionResult.appliedPromotions.map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          type: p.type,
          value: p.value ?? p.discount_amount,
          free_delivery: p.free_delivery
        })),
        itemBreakdowns: itemBreakdowns.map(item => ({
          id: item.id,
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: toNaira(item.unit_price_cents),
          totalPrice: toNaira(item.total_price_cents)
        }))
      });

      return result;
      
    } catch (error) {
      logger.error(`❌ Order calculation failed (${input.calculation_source})`, error, JSON.stringify({
        itemCount: input.items.length,
        deliveryFee: input.delivery_fee,
        promotionCode: input.promotion_code,
        promotions: input.promotions?.length || 0
      }));
      
      throw new Error(`Order calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate promotions and discounts
   */
  private static calculatePromotions(
    subtotalCents: number,
    deliveryFeeCents: number,
    promotions: PromotionCalculation[],
    promotionCode?: string
  ) {
    let bestDiscountCents = 0;
    let bestDeliveryDiscountCents = 0;
    let appliedPromotions: PromotionCalculation[] = [];

    // If promotion code provided, find and apply it
    if (promotionCode) {
      const promotion = promotions.find(p => p.code === promotionCode);
      if (promotion) {
        const discountResult = this.applyPromotion(promotion, subtotalCents, deliveryFeeCents);
        bestDiscountCents = discountResult.discountCents;
        bestDeliveryDiscountCents = discountResult.deliveryDiscountCents;
        appliedPromotions = [promotion];
      }
    } else {
      // Find best automatic promotion
      for (const promotion of promotions) {
        const discountResult = this.applyPromotion(promotion, subtotalCents, deliveryFeeCents);
        const totalDiscountValue = discountResult.discountCents + discountResult.deliveryDiscountCents;
        const currentBestValue = bestDiscountCents + bestDeliveryDiscountCents;
        
        if (totalDiscountValue > currentBestValue) {
          bestDiscountCents = discountResult.discountCents;
          bestDeliveryDiscountCents = discountResult.deliveryDiscountCents;
          appliedPromotions = [promotion];
        }
      }
    }

    return {
      discountCents: bestDiscountCents,
      deliveryDiscountCents: bestDeliveryDiscountCents,
      appliedPromotions
    };
  }

  /**
   * Apply a single promotion (FIXED: Use 'value' field to match server)
   */
  private static applyPromotion(
    promotion: PromotionCalculation,
    subtotalCents: number,
    deliveryFeeCents: number
  ) {
    let discountCents = 0;
    let deliveryDiscountCents = 0;

    // Use 'value' field (matches server) with fallback to 'discount_amount' for compatibility
    const promotionValue = promotion.value ?? promotion.discount_amount ?? 0;

    switch (promotion.type) {
      case 'percentage':
        discountCents = Math.round((subtotalCents * promotionValue) / 100);
        break;
        
      case 'fixed_amount':
        discountCents = Math.min(toCents(promotionValue), subtotalCents);
        break;
        
      case 'free_delivery':
        deliveryDiscountCents = deliveryFeeCents;
        break;
    }

    // Handle free delivery flag
    if (promotion.free_delivery) {
      deliveryDiscountCents = deliveryFeeCents;
    }

    return { discountCents, deliveryDiscountCents };
  }

  /**
   * Compare two calculation results and check if they're within tolerance
   */
  static compareCalculations(
    clientResult: OrderCalculationResult,
    serverResult: OrderCalculationResult
  ): {
    matches: boolean;
    difference: number;
    tolerance: number;
    details: {
      subtotal_diff: number;
      delivery_diff: number;
      discount_diff: number;
      total_diff: number;
    };
  } {
    const totalDiff = Math.abs(clientResult.total_amount - serverResult.total_amount);
    const subtotalDiff = Math.abs(clientResult.subtotal - serverResult.subtotal);
    const deliveryDiff = Math.abs(clientResult.delivery_fee - serverResult.delivery_fee);
    const discountDiff = Math.abs(clientResult.discount_amount - serverResult.discount_amount);

    const matches = totalDiff <= CALCULATION_TOLERANCE;

    logger.info('Calculation comparison', {
      clientTotal: clientResult.total_amount,
      serverTotal: serverResult.total_amount,
      difference: totalDiff,
      tolerance: CALCULATION_TOLERANCE,
      matches,
      breakdown: {
        subtotal_diff: subtotalDiff,
        delivery_diff: deliveryDiff,
        discount_diff: discountDiff,
        total_diff: totalDiff
      }
    });

    return {
      matches,
      difference: totalDiff,
      tolerance: CALCULATION_TOLERANCE,
      details: {
        subtotal_diff: subtotalDiff,
        delivery_diff: deliveryDiff,
        discount_diff: discountDiff,
        total_diff: totalDiff
      }
    };
  }

  /**
   * Create a server-authoritative result when calculations don't match
   */
  static createAuthoritativeResult(
    serverResult: OrderCalculationResult,
    clientResult: OrderCalculationResult,
    reason: string
  ): OrderCalculationResult {
    logger.warn(`Using server-authoritative calculation: ${reason}`, {
      serverTotal: serverResult.total_amount,
      clientTotal: clientResult.total_amount,
      difference: Math.abs(serverResult.total_amount - clientResult.total_amount)
    });

    return {
      ...serverResult,
      calculation_breakdown: {
        ...serverResult.calculation_breakdown,
        precision_adjustments: serverResult.calculation_breakdown.precision_adjustments + 1
      }
    };
  }
}

// Export utility functions for backward compatibility
export { toCents, toNaira, roundCurrency, calculateVATBreakdown };