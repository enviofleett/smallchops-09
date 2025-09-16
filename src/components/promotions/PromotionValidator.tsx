import React from 'react';
import { isPromotionValidForCurrentDay } from '@/lib/discountCalculations';
import type { Promotion } from '@/api/promotions';

interface PromotionValidatorProps {
  promotion: Promotion;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Component to safely validate and render promotions
export const PromotionValidator: React.FC<PromotionValidatorProps> = ({ 
  promotion, 
  children, 
  fallback = null 
}) => {
  const isValid = React.useMemo(() => {
    try {
      return isPromotionValidForCurrentDay(promotion);
    } catch (error) {
      console.warn('Promotion validation error:', error);
      return false;
    }
  }, [promotion]);

  if (!isValid) {
    return fallback as React.ReactElement;
  }

  return children as React.ReactElement;
};