import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface CustomizationItem {
  id: string;
  name: string;
  price: number;
  original_price: number;
  discount_amount?: number;
  vat_rate: number;
  image_url?: string;
  quantity: number;
}

export interface CustomizationBundle {
  items: CustomizationItem[];
  totalAmount: number;
  totalOriginalAmount: number;
  totalDiscount: number;
  itemCount: number;
}

export const useCustomizationBuilder = () => {
  const [items, setItems] = useState<CustomizationItem[]>([]);
  const { toast } = useToast();

  const addItem = useCallback((product: any, quantity: number = 1) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      
      if (existingItem) {
        return prevItems.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      const newItem: CustomizationItem = {
        id: product.id,
        name: product.name,
        price: product.discounted_price || product.price,
        original_price: product.price,
        discount_amount: product.discount_amount || 0,
        vat_rate: product.vat_rate || 7.5,
        image_url: product.image_url,
        quantity,
      };

      return [...prevItems, newItem];
    });

    toast({
      title: "Added to customization",
      description: `${product.name} has been added to your custom order.`,
    });
  }, [toast]);

  const removeItem = useCallback((itemId: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const clearBuilder = useCallback(() => {
    setItems([]);
  }, []);

  const getBundle = useCallback((): CustomizationBundle => {
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalOriginalAmount = items.reduce((sum, item) => sum + (item.original_price * item.quantity), 0);
    const totalDiscount = totalOriginalAmount - totalAmount;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      totalAmount,
      totalOriginalAmount,
      totalDiscount,
      itemCount,
    };
  }, [items]);

  const isEmpty = items.length === 0;

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearBuilder,
    getBundle,
    isEmpty,
  };
};