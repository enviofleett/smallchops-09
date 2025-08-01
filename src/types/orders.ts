export type OrderStatus = 
  | 'pending'
  | 'confirmed' 
  | 'preparing' 
  | 'ready'
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled'
  | 'refunded'
  | 'completed';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
