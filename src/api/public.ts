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
  delivery_zone_id?: string;
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

  // Stripe payment endpoints removed in favor of Paystack integration


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
    const response = await supabase.functions.invoke('smtp-email-sender', {
      body: emailData
    });

    if (response.error) throw new Error(response.error.message);
    return response.data;
  }

  // Delivery zones
  async getDeliveryZones() {
    const response = await fetch(`${this.baseUrl}/delivery-zones`);
    if (!response.ok) throw new Error('Failed to fetch delivery zones');
    return response.json();
  }

  // About Us API endpoints
  async getAboutUsComplete() {
    const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/complete`);
    if (!response.ok) throw new Error('Failed to fetch about us content');
    return response.json();
  }

  async getAboutUsHero() {
    const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/hero`);
    if (!response.ok) throw new Error('Failed to fetch hero section');
    return response.json();
  }

  async getAboutUsStory() {
    const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/story`);
    if (!response.ok) throw new Error('Failed to fetch story section');
    return response.json();
  }

  async getAboutUsValues() {
    const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/values`);
    if (!response.ok) throw new Error('Failed to fetch values section');
    return response.json();
  }

  async getAboutUsTeam() {
    const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/team`);
    if (!response.ok) throw new Error('Failed to fetch team data');
    return response.json();
  }

  async getAboutUsGallery(category?: string, limit: number = 20, offset: number = 0) {
    const params = new URLSearchParams({ 
      limit: limit.toString(), 
      offset: offset.toString() 
    });
    if (category) params.append('category', category);
    
    const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/gallery?${params}`);
    if (!response.ok) throw new Error('Failed to fetch gallery');
    return response.json();
  }

  async getAboutUsContact() {
    const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/contact`);
    if (!response.ok) throw new Error('Failed to fetch contact section');
    return response.json();
  }
}

export const publicAPI = new PublicAPIService();