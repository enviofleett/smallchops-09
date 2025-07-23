import { supabase } from '@/integrations/supabase/client';

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  customizations?: Record<string, any>;
  special_instructions?: string;
}

export interface CheckoutData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_type: 'delivery' | 'pickup';
  delivery_address?: string;
  special_instructions?: string;
  promotion_code?: string;
}

export interface OrderSummary {
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
}

class PublicAPIService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-api`;
  }

  // Categories
  async getCategories() {
    const response = await fetch(`${this.baseUrl}/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  }

  // Products
  async getProducts(categoryId?: string) {
    const url = categoryId 
      ? `${this.baseUrl}/products?category_id=${categoryId}`
      : `${this.baseUrl}/products`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  }

  // Promotions
  async getActivePromotions() {
    const response = await fetch(`${this.baseUrl}/promotions`);
    if (!response.ok) throw new Error('Failed to fetch promotions');
    return response.json();
  }

  async validatePromotion(code: string, orderAmount: number) {
    const response = await fetch(`${this.baseUrl}/validate-promotion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, order_amount: orderAmount })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to validate promotion');
    }
    return response.json();
  }

  // Customer registration
  async registerCustomer(customerData: {
    name: string;
    email: string;
    phone?: string;
    date_of_birth?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerData)
    });
    
    if (!response.ok) throw new Error('Failed to register customer');
    return response.json();
  }

  // Order creation
  async createOrder(orderData: CheckoutData & {
    items: CartItem[];
    subtotal: number;
    tax_amount: number;
    delivery_fee: number;
    discount_amount: number;
    total_amount: number;
  }) {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    
    if (!response.ok) throw new Error('Failed to create order');
    return response.json();
  }

  // Order retrieval
  async getOrder(orderIdOrNumber: string) {
    const response = await fetch(`${this.baseUrl}/orders/${orderIdOrNumber}`);
    if (!response.ok) throw new Error('Failed to fetch order');
    return response.json();
  }

  // Payment processing
  async createPayment(orderId: string, amount: number, customerEmail?: string) {
    const response = await supabase.functions.invoke('create-payment', {
      body: {
        orderId,
        amount: Math.round(amount * 100), // Convert to cents
        customerEmail,
        description: `Order Payment`
      }
    });

    if (response.error) throw new Error(response.error.message);
    return response.data;
  }

  async verifyPayment(sessionId: string, orderId?: string) {
    const response = await supabase.functions.invoke('verify-payment', {
      body: { sessionId, orderId }
    });

    if (response.error) throw new Error(response.error.message);
    return response.data;
  }

  // Send email
  async sendEmail(emailData: {
    to: string;
    toName?: string;
    subject: string;
    template?: string;
    variables?: Record<string, any>;
    html?: string;
    text?: string;
  }) {
    const response = await supabase.functions.invoke('send-email', {
      body: emailData
    });

    if (response.error) throw new Error(response.error.message);
    return response.data;
  }
}

export const publicAPI = new PublicAPIService();