// Order Debug Utility for Payment Investigation
// Use this to debug specific order issues like ORD1755860947fb0969

export interface OrderDebugInfo {
  orderId: string;
  orderNumber: string;
  reference: string;
  totalAmount: number;
  deliveryFee: number;
  paymentStatus: string;
  fulfillmentType: string;
  createdAt: string;
  lastUpdated: string;
}

export function logOrderDebugInfo(
  operation: string,
  orderInfo: Partial<OrderDebugInfo>,
  additionalData?: any
) {
  const timestamp = new Date().toISOString();
  const debugEntry = {
    timestamp,
    operation,
    order_info: orderInfo,
    additional_data: additionalData,
    debug_trace: `${operation} - ${orderInfo.orderNumber || orderInfo.orderId || 'unknown'}`
  };
  
  console.log('🔍 ORDER DEBUG:', JSON.stringify(debugEntry, null, 2));
  
  // In production, this could also send to monitoring service
  return debugEntry;
}

export function trackPaymentReference(reference: string, context: string, data?: any) {
  console.log('📋 PAYMENT REFERENCE TRACKING:', {
    reference,
    context,
    timestamp: new Date().toISOString(),
    data
  });
}

export function trackDeliveryFeeCalculation(
  orderId: string,
  zoneId: string | null,
  calculatedFee: number,
  context: string
) {
  console.log('💰 DELIVERY FEE TRACKING:', {
    order_id: orderId,
    delivery_zone_id: zoneId,
    calculated_fee: calculatedFee,
    context,
    timestamp: new Date().toISOString()
  });
}

export function trackOrderTotalUpdate(
  orderId: string,
  originalTotal: number,
  deliveryFee: number,
  finalTotal: number,
  context: string
) {
  console.log('💳 ORDER TOTAL TRACKING:', {
    order_id: orderId,
    original_total: originalTotal,
    delivery_fee: deliveryFee,
    final_total: finalTotal,
    context,
    timestamp: new Date().toISOString(),
    calculation_check: originalTotal + deliveryFee === finalTotal
  });
}