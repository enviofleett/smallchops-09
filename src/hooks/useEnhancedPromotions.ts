// Enhanced Promotions Hook
// Provides comprehensive promotion validation with server-client consistency

import { useState, useCallback, useMemo } from 'react';
import { validatePromotionCode } from '@/api/promotionValidation';
import { PromotionNormalizer } from '@/services/PromotionNormalizer';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';

export interface EnhancedPromotionState {
  code: string;
  normalizedCode: string | null;
  isValid: boolean;
  isValidating: boolean;
  error: string | null;
  discount_amount: number;
  promotion: any | null;
  attempts_remaining: number;
  rate_limited: boolean;
  bogo_items: any[];
}

export interface PromotionValidationOptions {
  orderAmount: number;
  customerEmail?: string;
  customerId?: string;
  cartItems?: any[];
  showToasts?: boolean;
}

export const useEnhancedPromotions = () => {
  const [promotionState, setPromotionState] = useState<EnhancedPromotionState>({
    code: '',
    normalizedCode: null,
    isValid: false,
    isValidating: false,
    error: null,
    discount_amount: 0,
    promotion: null,
    attempts_remaining: 10,
    rate_limited: false,
    bogo_items: []
  });

  /**
   * Update promotion code with real-time validation
   */
  const updatePromotionCode = useCallback((code: string) => {
    const { normalizedCode, error } = PromotionNormalizer.prepareForValidation(code);
    
    setPromotionState(prev => ({
      ...prev,
      code: code,
      normalizedCode: normalizedCode,
      error: error,
      isValid: false, // Reset validity when code changes
      discount_amount: 0,
      promotion: null,
      bogo_items: []
    }));
  }, []);

  /**
   * Validate promotion code against server
   */
  const validatePromotion = useCallback(async (options: PromotionValidationOptions) => {
    const { orderAmount, customerEmail, customerId, cartItems, showToasts = true } = options;

    if (!promotionState.normalizedCode) {
      const error = promotionState.error || 'Please enter a valid promotion code';
      setPromotionState(prev => ({ ...prev, error }));
      return false;
    }

    setPromotionState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      logger.info('🎟️ Validating promotion code', {
        originalCode: promotionState.code,
        normalizedCode: promotionState.normalizedCode,
        orderAmount
      });

      const result = await validatePromotionCode(
        promotionState.code, // Use original code for server validation
        orderAmount,
        customerEmail,
        customerId,
        cartItems
      );

      if (result.valid) {
        setPromotionState(prev => ({
          ...prev,
          isValid: true,
          error: null,
          discount_amount: result.discount_amount || 0,
          promotion: result.promotion,
          attempts_remaining: result.attempts_remaining || 10,
          rate_limited: false,
          bogo_items: result.bogo_items || [],
          isValidating: false
        }));

        if (showToasts) {
          toast({
            title: "Promotion Applied! 🎉",
            description: `You saved ₦${(result.discount_amount || 0).toLocaleString()}`,
          });
        }

        logger.info('✅ Promotion validated successfully', {
          promotionId: result.promotion?.id,
          discountAmount: result.discount_amount,
          normalizedCode: result.normalized_code
        });

        return true;
      } else {
        const errorMessage = result.error || 'Invalid promotion code';
        setPromotionState(prev => ({
          ...prev,
          isValid: false,
          error: errorMessage,
          discount_amount: 0,
          promotion: null,
          attempts_remaining: result.attempts_remaining || 0,
          rate_limited: result.rate_limited || false,
          bogo_items: [],
          isValidating: false
        }));

        if (showToasts && !result.rate_limited) {
          toast({
            title: "Invalid Promotion Code",
            description: errorMessage,
            variant: "destructive"
          });
        }

        if (result.rate_limited && showToasts) {
          toast({
            title: "Too Many Attempts",
            description: "Please wait before trying again.",
            variant: "destructive"
          });
        }

        logger.warn('❌ Promotion validation failed', {
          originalCode: promotionState.code,
          error: errorMessage,
          rateLimited: result.rate_limited,
          attemptsRemaining: result.attempts_remaining
        });

        return false;
      }
    } catch (error) {
      const errorMessage = 'Network error. Please check your connection.';
      setPromotionState(prev => ({
        ...prev,
        isValid: false,
        error: errorMessage,
        isValidating: false
      }));

      if (showToasts) {
        toast({
          title: "Connection Error",
          description: errorMessage,
          variant: "destructive"
        });
      }

      logger.error('❌ Promotion validation network error', error);
      return false;
    }
  }, [promotionState.code, promotionState.normalizedCode, promotionState.error]);

  /**
   * Clear promotion state
   */
  const clearPromotion = useCallback(() => {
    setPromotionState({
      code: '',
      normalizedCode: null,
      isValid: false,
      isValidating: false,
      error: null,
      discount_amount: 0,
      promotion: null,
      attempts_remaining: 10,
      rate_limited: false,
      bogo_items: []
    });
  }, []);

  /**
   * Check if code format is valid (client-side only)
   */
  const isCodeFormatValid = useMemo(() => {
    return PromotionNormalizer.isValidFormat(promotionState.code);
  }, [promotionState.code]);

  /**
   * Get user-friendly validation message
   */
  const validationMessage = useMemo(() => {
    if (promotionState.code && !isCodeFormatValid) {
      return PromotionNormalizer.getValidationError(promotionState.code);
    }
    return promotionState.error;
  }, [promotionState.code, promotionState.error, isCodeFormatValid]);

  return {
    // State
    promotionState,
    isCodeFormatValid,
    validationMessage,
    
    // Actions
    updatePromotionCode,
    validatePromotion,
    clearPromotion
  };
};