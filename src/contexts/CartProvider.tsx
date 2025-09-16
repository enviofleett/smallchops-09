import React from 'react';
import { CartContext } from './CartContext';
import { useCartInternal } from '@/hooks/useCart';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useCartInternal();
  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
