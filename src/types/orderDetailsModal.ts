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

export interface Customer {
  id?: string;
  name: string;
  email: string;
  phone: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  image_url?: string;
  features?: string[];
}

export interface OrderItem {
  id: string;
  product_name?: string;
  name?: string; // For backward compatibility 
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

export interface TimelineStep {
  step: string;
  label: string;
  completed: boolean;
  datetime?: string;
  status: 'completed' | 'current' | 'pending';
}

export interface DeliveryInfo {
  address: Address | string;
  delivery_window?: string;
  delivery_date?: string;
  delivery_time_start?: string;
  delivery_time_end?: string;
  special_instructions?: string;
}

export interface PickupInfo {
  address: string;
  pickup_window?: string;
  pickup_time?: string;
  pickup_point_name?: string;
  pickup_point_phone?: string;
  operating_hours?: any;
  special_instructions?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  base_fee?: number;
  description?: string;
}

export interface Order {
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
  timeline: TimelineStep[];
  // Additional fields for comprehensive data
  subtotal?: number;
  tax_amount?: number;
  delivery_fee?: number;
  discount_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  paid_at?: string;
  processing_started_at?: string;
  // Payment fields
  payment_method?: string;
  payment_reference?: string;
  // Driver assignment fields
  assigned_rider_id?: string;
  assigned_rider_name?: string;
  // Delivery fields
  delivery_window?: string;
  delivery_zone_id?: string;
  delivery_zone?: DeliveryZone;
}

export interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  order?: Order;
}

export interface OrderModalState {
  isLoading: boolean;
  error: string | null;
  order: Order | null;
  isUpdatingStatus: boolean;
  isPrinting: boolean;
}

export interface OrderStatusUpdatePayload {
  orderId: string;
  newStatus: OrderStatus;
  notes?: string;
}

export interface PrintOptions {
  includeCustomerInfo: boolean;
  includeTimeline: boolean;
  includeInternalNotes: boolean;
}

export interface CopyToClipboardResult {
  success: boolean;
  message: string;
}