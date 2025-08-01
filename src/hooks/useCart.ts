import { useState, useEffect } from 'react';

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  original_price?: number;
  discount_amount?: number;
  quantity: number;
  customizations?: Record<string, any>;
  special_instructions?: string;
}

export interface OrderSummary {
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
}

const CART_STORAGE_KEY = 'restaurant_cart';
const TAX_RATE = 0.08; // 8% tax rate
const DELIVERY_FEE = 5.99;
const FREE_DELIVERY_THRESHOLD = 30;

export interface Cart {
  items: CartItem[];
  summary: OrderSummary;
  itemCount: number;
}

export const useCart = () => {
  const [cart, setCart] = useState<Cart>({
    items: [],
    summary: {
      subtotal: 0,
      tax_amount: 0,
      delivery_fee: 0,
      discount_amount: 0,
      total_amount: 0
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

  const calculateCartSummary = (items: CartItem[], discountAmount = 0, deliveryFee = 0): Cart => {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax_amount = subtotal * TAX_RATE;
    const total_amount = subtotal + tax_amount + deliveryFee - discountAmount;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      summary: {
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(tax_amount * 100) / 100,
        delivery_fee: Math.round(deliveryFee * 100) / 100,
        discount_amount: Math.round(discountAmount * 100) / 100,
        total_amount: Math.round(total_amount * 100) / 100
      },
      itemCount
    };
  };

  const addItem = (product: {
    id: string;
    name: string;
    price: number;
    original_price?: number;
    discount_amount?: number;
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
      customizations: product.customizations,
      special_instructions: product.special_instructions
    };

    const updatedItems = [...cart.items, newItem];
    setCart(calculateCartSummary(updatedItems));
  };

  const removeItem = (cartItemId: string) => {
    const updatedItems = cart.items.filter(item => item.id !== cartItemId);
    setCart(calculateCartSummary(updatedItems));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartItemId);
      return;
    }

    const updatedItems = cart.items.map(item =>
      item.id === cartItemId ? { ...item, quantity } : item
    );
    setCart(calculateCartSummary(updatedItems));
  };

  const clearCart = () => {
    setCart({
      items: [],
      summary: {
        subtotal: 0,
        tax_amount: 0,
        delivery_fee: 0,
        discount_amount: 0,
        total_amount: 0
      },
      itemCount: 0
    });
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const updateDeliveryFee = (deliveryFee: number) => {
    setCart(calculateCartSummary(cart.items, cart.summary.discount_amount, deliveryFee));
  };

  const updateCartSummary = (discountAmount = 0, deliveryFee = cart.summary.delivery_fee) => {
    setCart(calculateCartSummary(cart.items, discountAmount, deliveryFee));
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
    updateCartSummary,
    getCartTotal,
    getItemCount,
    isEmpty
  };
};