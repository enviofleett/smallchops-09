/**
 * TypeScript interfaces for standardized order creation
 * Phase 2 of RPC function consolidation
 */

export interface CreateOrderResult {
  success: boolean;
  order_id?: string;
  order_number?: string;
  total_amount?: number;
  error?: string;
}

export interface CreateOrderItem {
  product_id: string;
  quantity: number;
  price: number;
}

/**
 * Type guard to check if order creation was successful
 */
export function isOrderCreationSuccess(result: unknown): result is Required<Pick<CreateOrderResult, 'success' | 'order_id' | 'order_number'>> & CreateOrderResult {
  const typed = result as CreateOrderResult;
  return typed && typed.success === true && !!typed.order_id && !!typed.order_number;
}

/**
 * Type guard to check if order creation failed
 */
export function isOrderCreationError(result: unknown): result is Required<Pick<CreateOrderResult, 'success' | 'error'>> & CreateOrderResult {
  const typed = result as CreateOrderResult;
  return typed && typed.success === false && !!typed.error;
}