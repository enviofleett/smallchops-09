// Enhanced VAT Calculations using OrderCalculationService
// Provides backward compatibility while using new calculation engine

import { OrderCalculationService, type CalculationItem, type OrderCalculationResult } from '@/services/OrderCalculationService';
import { logger } from '@/lib/logger';

// Re-export interfaces for backward compatibility
export interface VATBreakdown {
  cost_price: number;
  vat_amount: number;
  total_price: number;
  vat_rate: number;
}

export interface CartVATSummary {
  subtotal_cost: number;
  total_vat: number;
  delivery_fee: number;
  grand_total: number;
  items_breakdown: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
    unit_vat: number;
    unit_price: number;
    total_cost: number;
    total_vat: number;
    total_price: number;
    vat_rate: number;
  }>;
}

/**
 * Enhanced VAT breakdown calculation using integer arithmetic
 */
export function calculateVATBreakdown(
  price: number, 
  vatRate: number = 7.5
): VATBreakdown {
  const startTime = performance.now();
  
  // Use integer arithmetic to prevent floating point issues
  const totalPriceCents = Math.round(price * 100);
  const vatRateDecimal = vatRate / 100;
  
  // Calculate pre-VAT cost using precise integer math
  const costPriceCents = Math.round(totalPriceCents / (1 + vatRateDecimal));
  const vatAmountCents = totalPriceCents - costPriceCents;
  
  const result = {
    cost_price: Math.round(costPriceCents) / 100,
    vat_amount: Math.round(vatAmountCents) / 100,
    total_price: Math.round(totalPriceCents) / 100,
    vat_rate: vatRate
  };

  const calculationTime = performance.now() - startTime;
  
  logger.debug('VAT breakdown calculated', {
    input: { price, vatRate },
    output: result,
    calculationTimeMs: Math.round(calculationTime * 100) / 100
  });

  return result;
}

/**
 * Enhanced cart VAT summary using new calculation service
 */
export function calculateCartVATSummary(
  cartItems: Array<{
    product_id: string;
    product_name: string;
    price: number;
    quantity: number;
    vat_rate?: number;
  }>,
  deliveryFee: number = 0
): CartVATSummary {
  const startTime = performance.now();
  
  // Convert cart items to calculation format
  const calculationItems: CalculationItem[] = cartItems.map(item => ({
    id: item.product_id,
    product_id: item.product_id,
    product_name: item.product_name,
    price: item.price,
    quantity: item.quantity,
    vat_rate: item.vat_rate || 7.5
  }));

  // Use OrderCalculationService for consistent calculation
  const calculationResult = OrderCalculationService.calculateOrder({
    items: calculationItems,
    delivery_fee: deliveryFee,
    promotions: [],
    calculation_source: 'client'
  });

  // Create detailed items breakdown
  const items_breakdown = cartItems.map(item => {
    const vatBreakdown = calculateVATBreakdown(item.price, item.vat_rate || 7.5);
    
    return {
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_cost: vatBreakdown.cost_price,
      unit_vat: vatBreakdown.vat_amount,
      unit_price: item.price,
      total_cost: Math.round(vatBreakdown.cost_price * item.quantity * 100) / 100,
      total_vat: Math.round(vatBreakdown.vat_amount * item.quantity * 100) / 100,
      total_price: Math.round(item.price * item.quantity * 100) / 100,
      vat_rate: item.vat_rate || 7.5
    };
  });

  const result: CartVATSummary = {
    subtotal_cost: calculationResult.subtotal_cost,
    total_vat: calculationResult.total_vat,
    delivery_fee: deliveryFee,
    grand_total: calculationResult.subtotal + deliveryFee,
    items_breakdown
  };

  const calculationTime = performance.now() - startTime;
  
  logger.info('Cart VAT summary calculated', {
    itemsCount: cartItems.length,
    deliveryFee,
    result: {
      subtotal_cost: result.subtotal_cost,
      total_vat: result.total_vat,
      grand_total: result.grand_total
    },
    calculationTimeMs: Math.round(calculationTime * 100) / 100
  });

  return result;
}

/**
 * Format currency with consistent rounding
 */
export function formatCurrency(amount: number): string {
  // Use precise rounding to prevent display issues
  const roundedAmount = Math.round(amount * 100) / 100;
  return `₦${roundedAmount.toFixed(2)}`;
}

/**
 * Validate VAT calculation with enhanced tolerance
 */
export function validateVATCalculation(
  costPrice: number, 
  vatAmount: number, 
  totalPrice: number, 
  tolerance: number = 0.02 // Increased tolerance for floating point precision
): boolean {
  const calculatedTotal = Math.round((costPrice + vatAmount) * 100) / 100;
  const roundedTotalPrice = Math.round(totalPrice * 100) / 100;
  const difference = Math.abs(calculatedTotal - roundedTotalPrice);
  
  const isValid = difference <= tolerance;
  
  if (!isValid) {
    logger.warn('VAT calculation validation failed', {
      costPrice,
      vatAmount,
      totalPrice,
      calculatedTotal,
      difference,
      tolerance,
      isValid
    });
  }

  return isValid;
}

// Enhanced debugging function for VAT calculations
export function debugVATCalculation(
  price: number,
  vatRate: number = 7.5
): {
  breakdown: VATBreakdown;
  debugInfo: {
    priceCents: number;
    costPriceCents: number;
    vatAmountCents: number;
    totalCents: number;
    precisionLoss: number;
  };
} {
  const priceCents = Math.round(price * 100);
  const vatRateDecimal = vatRate / 100;
  const costPriceCents = Math.round(priceCents / (1 + vatRateDecimal));
  const vatAmountCents = priceCents - costPriceCents;
  
  const breakdown = calculateVATBreakdown(price, vatRate);
  
  // Calculate precision loss
  const recalculatedTotal = breakdown.cost_price + breakdown.vat_amount;
  const precisionLoss = Math.abs(recalculatedTotal - price);
  
  return {
    breakdown,
    debugInfo: {
      priceCents,
      costPriceCents,
      vatAmountCents,
      totalCents: priceCents,
      precisionLoss
    }
  };
}