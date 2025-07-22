export type OrderStatus = 
  | 'confirmed' 
  | 'preparing' 
  | 'ready'
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
