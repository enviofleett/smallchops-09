/**
 * Comprehensive Order Data Defensive Validation
 * Implements the defensive handling patterns specified in the requirements
 */

import { Order, OrderItem, Address, TimelineStep, OrderStatus, PaymentStatus, OrderType } from '@/types/orderDetailsModal';
import { formatAddress } from '@/utils/formatAddress';

// Valid status constants - matching the requirements
const VALID_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 
  'delivered', 'cancelled', 'refunded', 'completed', 'returned'
] as const;

const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
  'pending', 'paid', 'refunded', 'failed'
] as const;

const VALID_ORDER_TYPES: OrderType[] = [
  'delivery', 'pickup', 'dine_in'
] as const;

/**
 * Defensive status validation with safe fallback
 */
export function getSafeStatus(status: any): OrderStatus {
  if (typeof status === 'string' && VALID_STATUSES.includes(status as OrderStatus)) {
    return status as OrderStatus;
  }
  console.warn(`Invalid order status: "${status}". Using fallback: "pending"`);
  return 'pending'; // fallback to default
}

/**
 * Defensive payment status validation 
 */
export function getSafePaymentStatus(status: any): PaymentStatus {
  if (typeof status === 'string' && VALID_PAYMENT_STATUSES.includes(status as PaymentStatus)) {
    return status as PaymentStatus;
  }
  return 'pending';
}

/**
 * Defensive order type validation
 */
export function getSafeOrderType(type: any): OrderType {
  if (typeof type === 'string' && VALID_ORDER_TYPES.includes(type as OrderType)) {
    return type as OrderType;
  }
  return 'delivery';
}

/**
 * Safe OrderItem validation and transformation
 */
export function safeOrderItems(items: any[]): OrderItem[] {
  if (!Array.isArray(items)) return [];
  
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: String(item.id ?? ''),
      product_name: String(item.product_name ?? item.name ?? ''),
      quantity: Number(item.quantity ?? 1),
      unit_price: Number(item.unit_price ?? 0),
      total_price: Number(item.total_price ?? 0),
      vat_amount: item.vat_amount !== undefined ? Number(item.vat_amount) : undefined,
      discount_amount: item.discount_amount !== undefined ? Number(item.discount_amount) : undefined,
      customizations: item.customizations ?? undefined,
      special_instructions: item.special_instructions ? String(item.special_instructions) : undefined,
      product_id: item.product_id ? String(item.product_id) : undefined,
      product: item.product ? {
        id: String(item.product.id ?? ''),
        name: String(item.product.name ?? ''),
        features: Array.isArray(item.product.features) ? item.product.features.map(String) : undefined
      } : undefined
    }));
}

/**
 * Safe Address validation - handles all possible formats
 */
export function safeAddress(address: any): Address | null {
  if (!address) return null;
  
  // If it's a string, try to parse or treat as address_line_1
  if (typeof address === 'string') {
    const trimmed = address.trim();
    if (!trimmed) return null;
    
    // Try to parse JSON if it looks like JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return safeAddress(parsed);
      } catch {
        // If parsing fails, treat as plain text address
        return {
          address_line_1: trimmed
        };
      }
    }
    
    return {
      address_line_1: trimmed
    };
  }
  
  // Handle object addresses
  if (typeof address === 'object' && address !== null && !Array.isArray(address)) {
    // Handle nested address structure (address.address)
    const addr = address.address || address;
    
    return {
      address_line_1: String(addr.address_line_1 || addr.address || ''),
      address_line_2: addr.address_line_2 ? String(addr.address_line_2) : undefined,
      city: addr.city ? String(addr.city) : undefined,
      state: addr.state ? String(addr.state) : undefined,
      postal_code: addr.postal_code ? String(addr.postal_code) : undefined,
      country: addr.country ? String(addr.country) : undefined,
      landmark: addr.landmark ? String(addr.landmark) : undefined,
    };
  }
  
  return null;
}

/**
 * Safe Timeline validation with proper status progression
 */
export function safeTimeline(timeline: any[]): TimelineStep[] {
  if (!Array.isArray(timeline)) return [];
  
  return timeline
    .filter(t => t && typeof t === 'object' && typeof t.step === 'string')
    .map(t => ({
      step: String(t.step),
      label: String(t.label ?? t.step),
      completed: Boolean(t.completed),
      datetime: t.datetime ? String(t.datetime) : undefined,
      status: ['completed', 'current', 'pending'].includes(t.status) ? t.status : 'pending'
    }));
}

/**
 * Generate safe timeline from order status
 */
export function getTimelineFromStatus(orderStatus: OrderStatus): TimelineStep[] {
  const TIMELINE_STEPS = [
    { step: 'placed', label: 'Order Placed' },
    { step: 'confirmed', label: 'Order Confirmed' },
    { step: 'preparing', label: 'Preparing' },
    { step: 'ready', label: 'Ready for Pickup/Delivery' },
    { step: 'out_for_delivery', label: 'Out for Delivery' },
    { step: 'delivered', label: 'Delivered' },
    { step: 'completed', label: 'Completed' },
    { step: 'cancelled', label: 'Cancelled' },
    { step: 'refunded', label: 'Refunded' },
    { step: 'returned', label: 'Returned' },
  ];

  const statusIndex = VALID_STATUSES.indexOf(orderStatus);
  
  return TIMELINE_STEPS.map(step => {
    const stepIndex = VALID_STATUSES.indexOf(step.step as OrderStatus);
    const isCompleted = statusIndex >= stepIndex && stepIndex !== -1;
    
    return {
      step: step.step,
      label: step.label,
      completed: isCompleted,
      status: orderStatus === step.step 
        ? 'current' as const
        : isCompleted 
        ? 'completed' as const 
        : 'pending' as const
    };
  });
}

/**
 * Comprehensive safe order validation - main function matching requirements
 */
export function safeOrder(order: any): Order | null {
  if (!order || typeof order !== 'object') return null;
  
  try {
    return {
      id: String(order.id ?? ''),
      order_number: String(order.order_number ?? ''),
      status: getSafeStatus(order.status),
      order_type: getSafeOrderType(order.order_type),
      customer_name: String(order.customer_name ?? 'N/A'),
      customer_email: String(order.customer_email ?? ''),
      customer_phone: order.customer_phone ? String(order.customer_phone) : undefined,
      payment_status: getSafePaymentStatus(order.payment_status),
      total_amount: Number(order.total_amount ?? 0),
      created_at: String(order.created_at ?? ''),
      updated_at: order.updated_at ? String(order.updated_at) : undefined,
      order_time: String(order.order_time ?? order.created_at ?? new Date().toISOString()),
      items: safeOrderItems(order.items || []),
      delivery_address: safeAddress(order.delivery_address),
      pickup_time: order.pickup_time ? String(order.pickup_time) : undefined,
      pickup_point_id: order.pickup_point_id ? String(order.pickup_point_id) : undefined,
      special_instructions: order.special_instructions ? String(order.special_instructions) : undefined,
      timeline: order.timeline ? safeTimeline(order.timeline) : getTimelineFromStatus(getSafeStatus(order.status)),
      subtotal: order.subtotal !== undefined ? Number(order.subtotal) : undefined,
      tax_amount: order.tax_amount !== undefined ? Number(order.tax_amount) : undefined,
      delivery_fee: order.delivery_fee !== undefined ? Number(order.delivery_fee) : undefined,
      discount_amount: order.discount_amount !== undefined ? Number(order.discount_amount) : undefined,
      vat_rate: order.vat_rate !== undefined ? Number(order.vat_rate) : undefined,
      vat_amount: order.vat_amount !== undefined ? Number(order.vat_amount) : undefined,
      paid_at: order.paid_at ? String(order.paid_at) : undefined,
      processing_started_at: order.processing_started_at ? String(order.processing_started_at) : undefined,
      payment_method: order.payment_method ? String(order.payment_method) : undefined,
      payment_reference: order.payment_reference ? String(order.payment_reference) : undefined,
      assigned_rider_id: order.assigned_rider_id ? String(order.assigned_rider_id) : undefined,
      assigned_rider_name: order.assigned_rider_name ? String(order.assigned_rider_name) : undefined,
      delivery_window: order.delivery_window ? String(order.delivery_window) : undefined,
    };
  } catch (error) {
    console.error('Failed to create safe order:', error);
    return null;
  }
}

/**
 * Status display mapping for UI
 */
export const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'returned', label: 'Returned' },
];

/**
 * Get display label for order status
 */
export function displayStatus(status: any): string {
  const safeStatus = getSafeStatus(status);
  return statusOptions.find(opt => opt.value === safeStatus)?.label || 'Unknown';
}

/**
 * Safe address display formatting
 */
export function displayAddress(address: any): string {
  const safeAddr = safeAddress(address);
  if (!safeAddr) return 'N/A';
  
  return formatAddress(safeAddr);
}

/**
 * Safe order total calculation with validation
 */
export function calculateSafeOrderTotal(order: any): number {
  const safeOrderData = safeOrder(order);
  if (!safeOrderData) return 0;
  
  // Use explicit total_amount if available and valid
  if (safeOrderData.total_amount > 0) {
    return safeOrderData.total_amount;
  }
  
  // Otherwise calculate from items + fees
  const itemsTotal = safeOrderData.items.reduce((sum, item) => sum + item.total_price, 0);
  const deliveryFee = safeOrderData.delivery_fee || 0;
  const vatAmount = safeOrderData.vat_amount || 0;
  const discountAmount = safeOrderData.discount_amount || 0;
  
  return Math.max(0, itemsTotal + deliveryFee + vatAmount - discountAmount);
}