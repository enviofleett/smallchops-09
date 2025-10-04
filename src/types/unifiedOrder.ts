/**
 * Unified Order type that consolidates Order and OrderWithItems
 * Used across all order detail components
 */

export type OrderStatus = 
  | 'pending'
  | 'confirmed' 
  | 'preparing' 
  | 'ready'
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled'
  | 'refunded'
  | 'completed'
  | 'returned';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type OrderType = 'delivery' | 'pickup' | 'dine_in';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  cost_price?: number;
  image_url?: string;
  features?: string | string[];
  ingredients?: string | string[];
  category_id?: string;
}

export interface OrderItem {
  id: string;
  product_name?: string;
  name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  vat_amount?: number;
  discount_amount?: number;
  customizations?: any;
  special_instructions?: string;
  product_id?: string;
  product?: Product;
}

export interface Address {
  address_line_1: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  landmark?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  base_fee?: number;
  description?: string;
}

export interface UnifiedOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  order_type: OrderType;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  payment_status: PaymentStatus;
  total_amount: number;
  created_at: string;
  updated_at?: string;
  order_time: string;
  items: OrderItem[];
  delivery_address?: Address | string | null;
  delivery_time?: string | null;
  delivery_date?: string | null;
  pickup_time?: string | null;
  pickup_point_id?: string;
  special_instructions?: string;
  subtotal?: number;
  tax_amount?: number;
  delivery_fee?: number;
  discount_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  paid_at?: string;
  payment_method?: string;
  payment_reference?: string;
  assigned_rider_id?: string;
  assigned_rider_name?: string;
  delivery_window?: string;
  delivery_zone_id?: string;
  delivery_zone?: DeliveryZone;
}
