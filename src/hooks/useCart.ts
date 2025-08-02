import { useState, useEffect } from 'react';
import { calculateAdvancedOrderDiscount, CartPromotion } from '@/lib/discountCalculations';
import { calculateCartVATSummary } from '@/lib/vatCalculations';
import { validatePromotionCode } from '@/api/productsWithDiscounts';
import { usePromotions } from './usePromotions';

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  original_price?: number;
  discount_amount?: number;
  quantity: number;
  vat_rate?: number;
  customizations?: Record<string, any>;
  special_instructions?: string;
}

export interface OrderSummary {
  subtotal: number;
  subtotal_cost: number;
  total_vat: number;
  tax_amount: number;
  delivery_fee: number;
  discount_amount: number;
  delivery_discount: number;
  total_amount: number;
  applied_promotions: CartPromotion[];
}

const CART_STORAGE_KEY = 'restaurant_cart';
const TAX_RATE = 0.08; // 8% tax rate
const DELIVERY_FEE = 5.99;
const FREE_DELIVERY_THRESHOLD = 30;

export interface Cart {
  items: CartItem[];
  summary: OrderSummary;
  itemCount: number;
  promotion_code?: string;
}

export const useCart = () => {
  const { data: promotions = [] } = usePromotions();
  const [cart, setCart] = useState<Cart>({
    items: [],
    summary: {
      subtotal: 0,
      subtotal_cost: 0,
      total_vat: 0,
      tax_amount: 0,
      delivery_fee: 0,
      discount_amount: 0,
      delivery_discount: 0,
      total_amount: 0,
      applied_promotions: []
    },
    itemCount: 0
  });

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(calculateCartSummary(parsedCart.items || []));
      } catch (error) {
        console.error('Error loading cart from storage:', error);
        clearCart();
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items: cart.items }));
  }, [cart.items]);

  const calculateCartSummary = (
    items: CartItem[], 
    deliveryFee = 0, 
    promotionCode?: string
  ): Cart => {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate VAT breakdown
    const vatSummary = calculateCartVATSummary(
      items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
        vat_rate: item.vat_rate || 7.5
      })),
      deliveryFee
    );

    // Calculate promotions using advanced discount calculation (after VAT calculation)
    const promotionResult = calculateAdvancedOrderDiscount(
      items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
        category_id: item.customizations?.category_id
      })),
      subtotal,
      deliveryFee,
      promotions,
      promotionCode
    );

    const finalDeliveryFee = deliveryFee - promotionResult.delivery_discount;
    const total_amount = subtotal + finalDeliveryFee - promotionResult.total_discount;

    return {
      items: promotionResult.updated_cart_items.map(updatedItem => {
        const originalItem = items.find(item => item.product_id === updatedItem.product_id);
        return originalItem ? { ...originalItem, ...updatedItem } : originalItem;
      }).filter(Boolean) as CartItem[],
      summary: {
        subtotal: Math.round(subtotal * 100) / 100,
        subtotal_cost: Math.round(vatSummary.subtotal_cost * 100) / 100,
        total_vat: Math.round(vatSummary.total_vat * 100) / 100,
        tax_amount: 0, // Deprecated - VAT replaces this
        delivery_fee: Math.round(deliveryFee * 100) / 100,
        discount_amount: Math.round(promotionResult.total_discount * 100) / 100,
        delivery_discount: Math.round(promotionResult.delivery_discount * 100) / 100,
        total_amount: Math.round(total_amount * 100) / 100,
        applied_promotions: promotionResult.applied_promotions
      },
      itemCount,
      promotion_code: promotionCode
    };
  };

  const addItem = (product: {
    id: string;
    name: string;
    price: number;
    original_price?: number;
    discount_amount?: number;
    vat_rate?: number;
    customizations?: Record<string, any>;
    special_instructions?: string;
  }, quantity = 1) => {
    const newItem: CartItem = {
      id: `${product.id}_${Date.now()}`, // Unique cart item ID
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      original_price: product.original_price,
      discount_amount: product.discount_amount,
      quantity,
      vat_rate: product.vat_rate || 7.5,
      customizations: product.customizations,
      special_instructions: product.special_instructions
    };

    const updatedItems = [...cart.items, newItem];
    setCart(calculateCartSummary(updatedItems, cart.summary.delivery_fee, cart.promotion_code));
  };

  const removeItem = (cartItemId: string) => {
    const updatedItems = cart.items.filter(item => item.id !== cartItemId);
    setCart(calculateCartSummary(updatedItems, cart.summary.delivery_fee, cart.promotion_code));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartItemId);
      return;
    }

    const updatedItems = cart.items.map(item =>
      item.id === cartItemId ? { ...item, quantity } : item
    );
    setCart(calculateCartSummary(updatedItems, cart.summary.delivery_fee, cart.promotion_code));
  };

  const clearCart = () => {
    setCart({
      items: [],
      summary: {
        subtotal: 0,
        subtotal_cost: 0,
        total_vat: 0,
        tax_amount: 0,
        delivery_fee: 0,
        discount_amount: 0,
        delivery_discount: 0,
        total_amount: 0,
        applied_promotions: []
      },
      itemCount: 0
    });
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const updateDeliveryFee = (deliveryFee: number) => {
    setCart(calculateCartSummary(cart.items, deliveryFee, cart.promotion_code));
  };

  const applyPromotionCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    try {
      const validation = await validatePromotionCode(code, cart.summary.subtotal);
      
      if (validation.valid) {
        setCart(calculateCartSummary(cart.items, cart.summary.delivery_fee, code));
        return { success: true, message: 'Promotion code applied successfully!' };
      } else {
        return { success: false, message: validation.error || 'Invalid promotion code' };
      }
    } catch (error) {
      return { success: false, message: 'Failed to validate promotion code' };
    }
  };

  const removePromotionCode = () => {
    setCart(calculateCartSummary(cart.items, cart.summary.delivery_fee));
  };

  const getCartTotal = () => cart.summary.total_amount;
  const getItemCount = () => cart.itemCount;
  const isEmpty = () => cart.items.length === 0;

  return {
    cart,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    updateDeliveryFee,
    applyPromotionCode,
    removePromotionCode,
    getCartTotal,
    getItemCount,
    isEmpty
  };
};