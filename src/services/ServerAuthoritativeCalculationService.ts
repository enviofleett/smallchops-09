// Server-Authoritative Calculation Service
// Ensures backend calculations always override client calculations when there are mismatches

import { supabase } from '@/integrations/supabase/client';
import { OrderCalculationService, OrderCalculationResult } from './OrderCalculationService';
import { logger } from '@/lib/logger';

export interface ServerCalculationRequest {
  order_id?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
  delivery_zone_id?: string;
  fulfillment_type: 'delivery' | 'pickup';
  promotion_code?: string;
  customer_id?: string;
  customer_email?: string;
}

export interface ServerCalculationResponse extends OrderCalculationResult {
  server_authoritative: boolean;
  calculation_source: 'client' | 'server' | 'hybrid';
  mismatch_details?: {
    client_total: number;
    server_total: number;
    difference: number;
    reason: string;
  };
}

export class ServerAuthoritativeCalculationService {
  /**
   * Get server-authoritative calculation by calling backend
   * CRITICAL: Always use server result when there's a mismatch
   */
  static async getAuthoritativeCalculation(
    request: ServerCalculationRequest
  ): Promise<ServerCalculationResponse> {
    try {
      logger.info('🔄 Requesting server-authoritative calculation', {
        orderId: request.order_id,
        itemCount: request.items.length,
        promotionCode: request.promotion_code,
        fulfillmentType: request.fulfillment_type
      });

      // Call the server calculation endpoint
      const { data: serverResult, error } = await supabase.functions.invoke('calculate-order-totals', {
        body: request
      });

      if (error) {
        logger.error('❌ Server calculation failed, using client fallback', error);
        throw new Error(`Server calculation failed: ${error.message}`);
      }

      if (!serverResult || !serverResult.success) {
        throw new Error(`Server calculation returned error: ${serverResult?.error || 'Unknown error'}`);
      }

      const authoritativeResult: ServerCalculationResponse = {
        ...serverResult.calculation,
        server_authoritative: true,
        calculation_source: 'server'
      };

      logger.info('✅ Server-authoritative calculation received', {
        orderId: request.order_id,
        serverTotal: authoritativeResult.total_amount,
        source: 'server'
      });

      return authoritativeResult;

    } catch (error) {
      logger.error('❌ Server calculation error, falling back to client', error);
      
      // Fallback to client calculation
      const clientResult = this.getClientCalculationFallback(request);
      return {
        ...clientResult,
        server_authoritative: false,
        calculation_source: 'client'
      };
    }
  }

  /**
   * Compare client and server calculations, use server as authoritative
   */
  static async validateClientCalculation(
    clientResult: OrderCalculationResult,
    request: ServerCalculationRequest
  ): Promise<ServerCalculationResponse> {
    try {
      // Get server calculation
      const serverResult = await this.getAuthoritativeCalculation(request);

      // Compare results
      const comparison = OrderCalculationService.compareCalculations(clientResult, serverResult);

      if (comparison.matches) {
        logger.info('✅ Client-server calculations match', {
          total: clientResult.total_amount,
          difference: comparison.difference
        });
        
        return {
          ...clientResult,
          server_authoritative: false,
          calculation_source: 'client' // Client is accurate, no need to override
        };
      } else {
        logger.warn('⚠️ Client-server calculation mismatch - using server result', {
          clientTotal: clientResult.total_amount,
          serverTotal: serverResult.total_amount,
          difference: comparison.difference,
          recommendation: comparison.recommendation
        });

        return {
          ...serverResult,
          server_authoritative: true,
          calculation_source: 'server',
          mismatch_details: {
            client_total: clientResult.total_amount,
            server_total: serverResult.total_amount,
            difference: comparison.difference,
            reason: comparison.recommendation === 'investigate' ? 
              'Significant calculation mismatch requires investigation' :
              'Server calculation used as authoritative source'
          }
        };
      }

    } catch (error) {
      logger.error('❌ Server validation failed, using client calculation', error);
      
      return {
        ...clientResult,
        server_authoritative: false,
        calculation_source: 'client'
      };
    }
  }

  /**
   * Client calculation fallback when server is unavailable
   */
  private static getClientCalculationFallback(request: ServerCalculationRequest): OrderCalculationResult {
    // Calculate delivery fee based on fulfillment type
    const deliveryFee = request.fulfillment_type === 'pickup' ? 0 : 0; // Will be calculated by delivery zone

    // Use OrderCalculationService for client calculation
    return OrderCalculationService.calculateOrder({
      items: request.items.map(item => ({
        id: item.product_id,
        product_id: item.product_id,
        product_name: 'Product', // Placeholder
        price: item.unit_price,
        quantity: item.quantity,
        vat_rate: 7.5
      })),
      delivery_fee: deliveryFee,
      promotions: [], // Will be validated separately
      promotion_code: request.promotion_code,
      calculation_source: 'client'
    });
  }

  /**
   * Handle calculation mismatch with user-friendly error
   */
  static createMismatchError(mismatchDetails: any): Error {
    const difference = Math.abs(mismatchDetails.client_total - mismatchDetails.server_total);
    
    if (difference > 100) { // More than ₦1.00
      return new Error(
        `There was a significant difference in order calculation (₦${difference.toFixed(2)}). ` +
        `Using server-calculated amount of ₦${mismatchDetails.server_total.toFixed(2)} for accuracy.`
      );
    } else {
      return new Error(
        `Order total has been adjusted to ₦${mismatchDetails.server_total.toFixed(2)} ` +
        `for payment accuracy.`
      );
    }
  }
}