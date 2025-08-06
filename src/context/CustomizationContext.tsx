import React, { createContext, useContext, ReactNode } from 'react';
import { useCustomizationBuilder, CustomizationItem, CustomizationBundle } from '@/hooks/useCustomizationBuilder';

interface CustomizationContextType {
  items: CustomizationItem[];
  addItem: (product: any, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearBuilder: () => void;
  getBundle: () => CustomizationBundle;
  isEmpty: boolean;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

export const useCustomizationContext = () => {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error('useCustomizationContext must be used within a CustomizationProvider');
  }
  return context;
};

interface CustomizationProviderProps {
  children: ReactNode;
}

export const CustomizationProvider: React.FC<CustomizationProviderProps> = ({ children }) => {
  const customizationBuilder = useCustomizationBuilder();

  return (
    <CustomizationContext.Provider value={customizationBuilder}>
      {children}
    </CustomizationContext.Provider>
  );
};