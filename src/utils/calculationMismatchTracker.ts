// Enhanced calculation mismatch tracking for production monitoring
// Tracks and analyzes order calculation discrepancies between client and server

import { logger } from '@/lib/logger';

export interface CalculationMismatch {
  orderId?: string;
  sessionId?: string;
  clientTotal: number;
  serverTotal: number;
  difference: number;
  tolerance: number;
  calculationDetails: {
    client_subtotal?: number;
    server_subtotal?: number;
    client_delivery_fee?: number;
    server_delivery_fee?: number;
    client_discount?: number;
    server_discount?: number;
    promotion_code?: string;
  };
  timestamp: number;
  resolution: 'tolerance_accepted' | 'server_authoritative' | 'failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CalculationMetrics {
  totalMismatches: number;
  averageDifference: number;
  maxDifference: number;
  commonCauses: string[];
  lastMismatch: number;
}

const MISMATCH_STORAGE_KEY = 'calculation_mismatches_v2';
const MAX_STORED_MISMATCHES = 50;

/**
 * Track a calculation mismatch for analysis
 */
export function trackCalculationMismatch(mismatch: CalculationMismatch): void {
  try {
    // Determine severity based on difference
    let severity: CalculationMismatch['severity'] = 'low';
    if (mismatch.difference > 10) severity = 'critical';
    else if (mismatch.difference > 5) severity = 'high';
    else if (mismatch.difference > 1) severity = 'medium';

    const enhancedMismatch = {
      ...mismatch,
      severity,
      id: `mismatch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Log based on severity
    if (severity === 'critical' || severity === 'high') {
      logger.error('🚨 Critical calculation mismatch detected', enhancedMismatch);
    } else {
      logger.warn('⚠️ Calculation mismatch detected', enhancedMismatch);
    }

    // Store for analysis
    const stored = JSON.parse(localStorage.getItem(MISMATCH_STORAGE_KEY) || '[]');
    stored.push(enhancedMismatch);

    // Keep only recent mismatches
    if (stored.length > MAX_STORED_MISMATCHES) {
      stored.splice(0, stored.length - MAX_STORED_MISMATCHES);
    }

    localStorage.setItem(MISMATCH_STORAGE_KEY, JSON.stringify(stored));

    // Send to backend for monitoring (non-blocking)
    sendMismatchToBackend(enhancedMismatch).catch(error => 
      console.warn('Failed to send mismatch to backend:', error)
    );

  } catch (error) {
    console.error('Failed to track calculation mismatch:', error);
  }
}

/**
 * Get calculation mismatch metrics
 */
export function getCalculationMetrics(): CalculationMetrics {
  try {
    const mismatches: CalculationMismatch[] = JSON.parse(
      localStorage.getItem(MISMATCH_STORAGE_KEY) || '[]'
    );

    if (mismatches.length === 0) {
      return {
        totalMismatches: 0,
        averageDifference: 0,
        maxDifference: 0,
        commonCauses: [],
        lastMismatch: 0
      };
    }

    const totalDifference = mismatches.reduce((sum, m) => sum + m.difference, 0);
    const maxDifference = Math.max(...mismatches.map(m => m.difference));
    const lastMismatch = Math.max(...mismatches.map(m => m.timestamp));

    // Analyze common causes
    const causes: Record<string, number> = {};
    mismatches.forEach(m => {
      if (m.calculationDetails.promotion_code) {
        causes['promotion_calculation'] = (causes['promotion_calculation'] || 0) + 1;
      }
      if (m.calculationDetails.client_delivery_fee !== m.calculationDetails.server_delivery_fee) {
        causes['delivery_fee_calculation'] = (causes['delivery_fee_calculation'] || 0) + 1;
      }
      if (m.difference < 1) {
        causes['rounding_precision'] = (causes['rounding_precision'] || 0) + 1;
      }
    });

    const commonCauses = Object.entries(causes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([cause]) => cause);

    return {
      totalMismatches: mismatches.length,
      averageDifference: Math.round((totalDifference / mismatches.length) * 100) / 100,
      maxDifference: Math.round(maxDifference * 100) / 100,
      commonCauses,
      lastMismatch
    };
  } catch (error) {
    console.error('Failed to calculate mismatch metrics:', error);
    return {
      totalMismatches: 0,
      averageDifference: 0,
      maxDifference: 0,
      commonCauses: [],
      lastMismatch: 0
    };
  }
}

/**
 * Clear mismatch tracking data
 */
export function clearMismatchData(): void {
  try {
    localStorage.removeItem(MISMATCH_STORAGE_KEY);
    logger.info('✅ Calculation mismatch data cleared');
  } catch (error) {
    console.warn('Failed to clear mismatch data:', error);
  }
}

/**
 * Send mismatch data to backend for centralized monitoring
 */
async function sendMismatchToBackend(mismatch: any): Promise<void> {
  try {
    // Only send critical mismatches to backend to avoid spam
    if (mismatch.severity === 'critical' || mismatch.severity === 'high') {
      // This could be enhanced to send to a monitoring edge function
      console.log('📊 Would send to backend monitoring:', mismatch);
    }
  } catch (error) {
    // Silent failure - don't disrupt user experience
    console.debug('Backend mismatch reporting failed:', error);
  }
}

/**
 * Export metrics for debugging
 */
export function exportMismatchData(): string {
  const mismatches = localStorage.getItem(MISMATCH_STORAGE_KEY) || '[]';
  const metrics = getCalculationMetrics();
  
  return JSON.stringify({
    metrics,
    mismatches: JSON.parse(mismatches)
  }, null, 2);
}
