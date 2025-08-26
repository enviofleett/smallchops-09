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
    try {
      const response = await fetch(`${this.baseUrl}/categories`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getCategories error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Products
  async getProducts(categoryId?: string) {
    try {
      const url = categoryId 
        ? `${this.baseUrl}/products?category_id=${encodeURIComponent(categoryId)}`
        : `${this.baseUrl}/products`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch products: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getProducts error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Promotions
  async getActivePromotions() {
    try {
      const response = await fetch(`${this.baseUrl}/promotions`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch promotions: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getActivePromotions error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  async validatePromotion(code: string, orderAmount: number) {
    try {
      if (!code?.trim()) {
        throw new Error('Promotion code is required');
      }
      if (typeof orderAmount !== 'number' || orderAmount <= 0) {
        throw new Error('Valid order amount is required');
      }

      const response = await fetch(`${this.baseUrl}/validate-promotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), order_amount: orderAmount })
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || `Failed to validate promotion: ${response.status} ${response.statusText}`);
        } catch {
          throw new Error(`Failed to validate promotion: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('validatePromotion error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Customer registration
  async registerCustomer(customerData: {
    name: string;
    email: string;
    phone?: string;
    date_of_birth?: string;
  }) {
    try {
      // Client-side validation
      if (!customerData.name?.trim()) {
        throw new Error('Customer name is required');
      }
      if (!customerData.email?.trim()) {
        throw new Error('Customer email is required');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) {
        throw new Error('Please enter a valid email address');
      }

      const response = await fetch(`${this.baseUrl}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerData.name.trim(),
          email: customerData.email.trim().toLowerCase(),
          phone: customerData.phone?.trim(),
          date_of_birth: customerData.date_of_birth
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || `Failed to register customer: ${response.status} ${response.statusText}`);
        } catch {
          throw new Error(`Failed to register customer: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('registerCustomer error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
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
    try {
      // Client-side validation
      if (!orderData.customer_name?.trim()) {
        throw new Error('Customer name is required');
      }
      if (!orderData.customer_email?.trim()) {
        throw new Error('Customer email is required');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderData.customer_email)) {
        throw new Error('Please enter a valid email address');
      }
      if (!orderData.items || orderData.items.length === 0) {
        throw new Error('Order must contain at least one item');
      }
      if (typeof orderData.total_amount !== 'number' || orderData.total_amount <= 0) {
        throw new Error('Valid order total is required');
      }

      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orderData,
          customer_name: orderData.customer_name.trim(),
          customer_email: orderData.customer_email.trim().toLowerCase(),
          customer_phone: orderData.customer_phone?.trim(),
          delivery_address: orderData.delivery_address?.trim(),
          special_instructions: orderData.special_instructions?.trim()
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || `Failed to create order: ${response.status} ${response.statusText}`);
        } catch {
          throw new Error(`Failed to create order: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('createOrder error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Order retrieval
  async getOrder(orderIdOrNumber: string) {
    try {
      if (!orderIdOrNumber?.trim()) {
        throw new Error('Order ID or number is required');
      }

      const response = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderIdOrNumber.trim())}`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        if (response.status === 404) {
          throw new Error('Order not found. Please check the order number and try again.');
        }
        throw new Error(`Failed to fetch order: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getOrder error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  // PAYSTACK-ONLY: All payment processing uses secure backend-generated references


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
    try {
      // Client-side validation
      if (!emailData.to?.trim()) {
        throw new Error('Recipient email is required');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailData.to)) {
        throw new Error('Please enter a valid recipient email address');
      }
      if (!emailData.subject?.trim()) {
        throw new Error('Email subject is required');
      }
      if (!emailData.template && !emailData.html && !emailData.text) {
        throw new Error('Email content is required (template, html, or text)');
      }

      const response = await supabase.functions.invoke('smtp-email-sender', {
        body: {
          to: emailData.to.trim().toLowerCase(),
          toName: emailData.toName?.trim(),
          subject: emailData.subject.trim(),
          template: emailData.template,
          variables: emailData.variables,
          html: emailData.html,
          text: emailData.text
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send email');
      }
      
      if (!response.data) {
        throw new Error('Invalid response: No data received from email service');
      }
      
      return response.data;
    } catch (error) {
      console.error('sendEmail error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to email service. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Delivery zones
  async getDeliveryZones() {
    try {
      const response = await fetch(`${this.baseUrl}/delivery-zones`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch delivery zones: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getDeliveryZones error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  // About Us API endpoints
  async getAboutUsComplete() {
    try {
      const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/complete`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch about us content: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getAboutUsComplete error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  async getAboutUsHero() {
    try {
      const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/hero`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch hero section: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getAboutUsHero error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  async getAboutUsStory() {
    try {
      const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/story`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch story section: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getAboutUsStory error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  async getAboutUsValues() {
    try {
      const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/values`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch values section: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getAboutUsValues error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  async getAboutUsTeam() {
    try {
      const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/team`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch team data: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getAboutUsTeam error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  async getAboutUsGallery(category?: string, limit: number = 20, offset: number = 0) {
    try {
      // Validate inputs
      if (typeof limit !== 'number' || limit <= 0 || limit > 100) {
        throw new Error('Limit must be a number between 1 and 100');
      }
      if (typeof offset !== 'number' || offset < 0) {
        throw new Error('Offset must be a non-negative number');
      }

      const params = new URLSearchParams({ 
        limit: limit.toString(), 
        offset: offset.toString() 
      });
      if (category?.trim()) {
        params.append('category', category.trim());
      }
      
      const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/gallery?${params}`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch gallery: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getAboutUsGallery error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  async getAboutUsContact() {
    try {
      const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-about-api/contact`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch contact section: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      if (!data) {
        throw new Error('Invalid response: No data received');
      }
      return data;
    } catch (error) {
      console.error('getAboutUsContact error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }
}

export const publicAPI = new PublicAPIService();