// Order Calculation Debugging and Logging Utilities
// Implements Phase 2 of senior engineer's recommendations

import { logger } from '@/lib/logger';
import { trackCalculationMismatch } from './calculationMismatchTracker';
import type { OrderCalculationResult } from '@/services/OrderCalculationService';

export interface CalculationLogData {
  orderId?: string;
  sessionId?: string;
  source: 'client' | 'server' | 'comparison';
  timestamp: number;
  calculation: OrderCalculationResult;
  userAgent?: string;
  itemCount: number;
  hasPromotions: boolean;
  calculationTimeMs?: number;
}

export interface CalculationMismatchLog {
  orderId?: string;
  sessionId?: string;
  clientCalculation: OrderCalculationResult;
  serverCalculation: OrderCalculationResult;
  difference: number;
  tolerance: number;
  mismatchDetails: {
    subtotal_diff: number;
    delivery_diff: number;
    discount_diff: number;
    total_diff: number;
  };
  timestamp: number;
  userAgent?: string;
  resolution: 'tolerance_accepted' | 'server_authoritative' | 'failed';
}

/**
 * Log detailed calculation breakdown for debugging
 */
export function logOrderCalculation(data: CalculationLogData): void {
  const logEntry = {
    event: 'order_calculation',
    source: data.source,
    orderId: data.orderId,
    sessionId: data.sessionId,
    timestamp: data.timestamp,
    userAgent: data.userAgent,
    performance: {
      calculationTimeMs: data.calculationTimeMs
    },
    orderDetails: {
      itemCount: data.itemCount,
      hasPromotions: data.hasPromotions,
      promotionCount: data.calculation.applied_promotions.length
    },
    calculations: {
      subtotal: data.calculation.subtotal,
      subtotalCost: data.calculation.subtotal_cost,
      totalVat: data.calculation.total_vat,
      deliveryFee: data.calculation.delivery_fee,
      discountAmount: data.calculation.discount_amount,
      deliveryDiscount: data.calculation.delivery_discount,
      totalAmount: data.calculation.total_amount
    },
    breakdown: data.calculation.calculation_breakdown,
    appliedPromotions: data.calculation.applied_promotions.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type,
      discountAmount: p.discount_amount
    }))
  };

  logger.info(`Order calculation logged (${data.source})`, logEntry);

  // Store in session storage for debugging
  try {
    const calculationHistory = JSON.parse(
      sessionStorage.getItem('calculation_history') || '[]'
    );
    calculationHistory.push({
      ...logEntry,
      id: `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    // Keep only last 50 calculations
    if (calculationHistory.length > 50) {
      calculationHistory.splice(0, calculationHistory.length - 50);
    }
    
    sessionStorage.setItem('calculation_history', JSON.stringify(calculationHistory));
  } catch (error) {
    console.warn('Failed to store calculation history:', error);
  }
}

/**
 * Log calculation mismatches for analysis
 */
export function logCalculationMismatch(mismatch: CalculationMismatchLog): void {
  const logEntry = {
    event: 'calculation_mismatch',
    orderId: mismatch.orderId,
    sessionId: mismatch.sessionId,
    timestamp: mismatch.timestamp,
    userAgent: mismatch.userAgent,
    mismatchSeverity: mismatch.difference > 5 ? 'critical' : mismatch.difference > 1 ? 'high' : 'low',
    comparison: {
      clientTotal: mismatch.clientCalculation.total_amount,
      serverTotal: mismatch.serverCalculation.total_amount,
      difference: mismatch.difference,
      tolerance: mismatch.tolerance,
      withinTolerance: mismatch.difference <= mismatch.tolerance
    },
    breakdown: mismatch.mismatchDetails,
    resolution: mismatch.resolution,
    calculationBreakdowns: {
      client: mismatch.clientCalculation.calculation_breakdown,
      server: mismatch.serverCalculation.calculation_breakdown
    }
  };

  if (mismatch.difference > mismatch.tolerance) {
    logger.error('Order calculation mismatch detected', logEntry);
  } else {
    logger.warn('Order calculation difference within tolerance', logEntry);
  }

  // Store critical mismatches for analysis
  if (mismatch.difference > 1) {
    try {
      const mismatchHistory = JSON.parse(
        localStorage.getItem('calculation_mismatches') || '[]'
      );
      mismatchHistory.push({
        ...logEntry,
        id: `mismatch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
      
      // Keep only last 20 mismatches
      if (mismatchHistory.length > 20) {
        mismatchHistory.splice(0, mismatchHistory.length - 20);
      }
      
      localStorage.setItem('calculation_mismatches', JSON.stringify(mismatchHistory));

      // Also track in the new enhanced mismatch tracker
      trackCalculationMismatch({
        orderId: mismatch.orderId,
        sessionId: mismatch.sessionId,
        clientTotal: mismatch.clientCalculation.total_amount,
        serverTotal: mismatch.serverCalculation.total_amount,
        difference: mismatch.difference,
        tolerance: mismatch.tolerance,
        calculationDetails: {
          client_subtotal: mismatch.clientCalculation.subtotal,
          client_delivery_fee: mismatch.clientCalculation.delivery_fee,
          client_discount: mismatch.clientCalculation.discount_amount
        },
        timestamp: mismatch.timestamp,
        resolution: mismatch.resolution,
        severity: mismatch.difference > 5 ? 'critical' : mismatch.difference > 1 ? 'high' : 'low'
      });
    } catch (error) {
      console.warn('Failed to store mismatch history:', error);
    }
  }
}

/**
 * Generate calculation debug report
 */
export function generateCalculationDebugReport(): {
  calculationHistory: any[];
  mismatchHistory: any[];
  summary: {
    totalCalculations: number;
    totalMismatches: number;
    averageCalculationTime: number;
    commonMismatchCauses: string[];
  };
} {
  try {
    const calculationHistory = JSON.parse(
      sessionStorage.getItem('calculation_history') || '[]'
    );
    const mismatchHistory = JSON.parse(
      localStorage.getItem('calculation_mismatches') || '[]'
    );

    // Calculate summary statistics
    const totalCalculations = calculationHistory.length;
    const totalMismatches = mismatchHistory.length;
    
    const calculationTimes = calculationHistory
      .filter(c => c.performance?.calculationTimeMs)
      .map(c => c.performance.calculationTimeMs);
    const averageCalculationTime = calculationTimes.length > 0 
      ? calculationTimes.reduce((a, b) => a + b, 0) / calculationTimes.length 
      : 0;

    // Analyze common mismatch causes
    const mismatchCauses = mismatchHistory.map(m => {
      const { breakdown } = m;
      if (breakdown.discount_diff > 0.5) return 'discount_calculation';
      if (breakdown.delivery_diff > 0.5) return 'delivery_calculation';
      if (breakdown.subtotal_diff > 0.5) return 'subtotal_calculation';
      return 'rounding_precision';
    });

    const commonMismatchCauses = [...new Set(mismatchCauses)] as string[];

    return {
      calculationHistory,
      mismatchHistory,
      summary: {
        totalCalculations,
        totalMismatches,
        averageCalculationTime: Math.round(averageCalculationTime * 100) / 100,
        commonMismatchCauses
      }
    };
  } catch (error) {
    console.error('Failed to generate debug report:', error);
    return {
      calculationHistory: [],
      mismatchHistory: [],
      summary: {
        totalCalculations: 0,
        totalMismatches: 0,
        averageCalculationTime: 0,
        commonMismatchCauses: []
      }
    };
  }
}

/**
 * Clear calculation debug data
 */
export function clearCalculationDebugData(): void {
  try {
    sessionStorage.removeItem('calculation_history');
    localStorage.removeItem('calculation_mismatches');
    logger.info('Calculation debug data cleared');
  } catch (error) {
    console.warn('Failed to clear debug data:', error);
  }
}

/**
 * Export calculation data for analysis
 */
export function exportCalculationData(): string {
  const debugReport = generateCalculationDebugReport();
  return JSON.stringify(debugReport, null, 2);
}
