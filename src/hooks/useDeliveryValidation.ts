import { useState, useCallback } from 'react';
import { validateDeliveryAddress, getDeliveryEstimate, DeliveryAddress, DeliveryValidationResult } from '@/api/delivery-validation';
import { toast } from 'sonner';

export const useDeliveryValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<DeliveryValidationResult | null>(null);

  const validateAddress = useCallback(async (address: DeliveryAddress, orderSubtotal: number) => {
    setIsValidating(true);
    try {
      const result = await validateDeliveryAddress(address, orderSubtotal);
      setValidationResult(result);
      
      if (!result.isValid) {
        toast.error(result.error || 'Delivery not available to this address');
      } else {
        toast.success(`Delivery available! Fee: ₦${result.fee.toFixed(2)}`);
      }
      
      return result;
    } catch (error) {
      console.error('Address validation error:', error);
      toast.error('Failed to validate delivery address');
      return null;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const getEstimate = useCallback(async (zoneId: string, orderSubtotal: number, distanceKm?: number) => {
    try {
      return await getDeliveryEstimate(zoneId, orderSubtotal, distanceKm);
    } catch (error) {
      console.error('Estimate error:', error);
      return { fee: 0, estimatedTime: 30 };
    }
  }, []);

  const clearValidation = useCallback(() => {
    setValidationResult(null);
  }, []);

  return {
    isValidating,
    validationResult,
    validateAddress,
    getEstimate,
    clearValidation
  };
};