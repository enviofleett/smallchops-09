import { OrderWithItems } from '@/api/orders';

// Adapter to convert orders_new data to old OrderWithItems structure
export function adaptNewOrderToOld(newOrder: any): OrderWithItems {
  return {
    // Core order fields
    id: newOrder.id,
    order_number: newOrder.order_number,
    customer_name: newOrder.customer_name,
    customer_email: newOrder.customer_email,
    customer_phone: newOrder.customer_phone,
    delivery_address: newOrder.delivery_address,
    status: newOrder.status,
    payment_status: newOrder.payment_status,
    payment_reference: newOrder.payment_reference,
    payment_verified_at: newOrder.payment_verified_at,
    total_amount: newOrder.total_amount,
    delivery_fee: newOrder.delivery_fee,
    tax_amount: newOrder.vat_amount || newOrder.tax_amount || 0,
    order_type: newOrder.order_type,
    order_time: newOrder.order_time,
    delivery_zone_id: newOrder.delivery_zone_id,
    assigned_rider_id: newOrder.assigned_rider_id,
    special_instructions: newOrder.special_instructions,
    admin_notes: newOrder.admin_notes,
    created_at: newOrder.created_at,
    updated_at: newOrder.updated_at,
    updated_by: newOrder.updated_by,
    
    // Required fields with defaults
    amount_kobo: Math.round((newOrder.total_amount || 0) * 100),
    created_by: newOrder.created_by || null,
    customer_id: newOrder.customer_id || null,
    delivery_status: newOrder.delivery_status || null,
    delivery_time: newOrder.delivery_time || null,
    delivery_time_slot_id: newOrder.delivery_time_slot_id || null,
    discount_amount: newOrder.discount_amount || null,
    email: newOrder.customer_email || null,
    estimated_delivery_date: newOrder.estimated_delivery_date || null,
    guest_session_id: newOrder.guest_session_id || null,
    idempotency_key: newOrder.idempotency_key || null,
    last_modified_by: newOrder.last_modified_by || null,
    paid_at: newOrder.paid_at || null,
    payment_method: newOrder.payment_method || null,
    paystack_reference: newOrder.paystack_reference || null,
    pickup_point_id: newOrder.pickup_point_id || null,
    pickup_ready: newOrder.pickup_ready || null,
    pickup_time: newOrder.pickup_time || null,
    preferred_delivery_time: newOrder.preferred_delivery_time || null,
    processing_lock: newOrder.processing_lock || null,
    processing_officer_id: newOrder.processing_officer_id || null,
    processing_officer_name: newOrder.processing_officer_name || null,
    processing_started_at: newOrder.processing_started_at || null,
    reference_updated_at: newOrder.reference_updated_at || null,
    subtotal: newOrder.subtotal || newOrder.total_amount || 0,
    subtotal_cost: newOrder.subtotal_cost || null,
    total_vat: newOrder.total_vat || newOrder.vat_amount || null,
    user_id: newOrder.user_id || null,
    
    // Map order items from new structure
    order_items: (newOrder.order_items_new || []).map((item: any) => ({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_price: item.product_price,
      quantity: item.quantity,
      total_price: item.total_price,
      customizations: item.customizations,
      created_at: item.created_at,
      updated_at: item.updated_at
    })),
    
    // Keep delivery zones (if any)
    delivery_zones: newOrder.delivery_zones,
    
    // Keep delivery schedule (if any)
    delivery_schedule: newOrder.delivery_schedule
  };
}

// Adapter to convert multiple orders
export function adaptNewOrdersToOld(newOrders: any[]): OrderWithItems[] {
  return newOrders.map(adaptNewOrderToOld);
}
