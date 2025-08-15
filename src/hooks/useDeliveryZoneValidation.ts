import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  calculateDeliveryFeeWithDistance, 
  validateAddressInZone,
  DeliveryAddress,
  DeliveryFeeCalculation 
} from '@/api/deliveryValidation';

interface UseDeliveryZoneValidationProps {
  selectedZoneId?: string;
  orderSubtotal: number;
  deliveryAddress?: DeliveryAddress;
}

export const useDeliveryZoneValidation = ({
  selectedZoneId,
  orderSubtotal,
  deliveryAddress
}: UseDeliveryZoneValidationProps) => {
  const [feeCalculation, setFeeCalculation] = useState<DeliveryFeeCalculation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAddressValid, setIsAddressValid] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Calculate delivery fee when zone or address changes
  useEffect(() => {
    if (!selectedZoneId) {
      setFeeCalculation(null);
      setIsAddressValid(null);
      setValidationError(null);
      return;
    }

    const calculateFee = async () => {
      try {
        setIsValidating(true);
        setValidationError(null);

        const calculation = await calculateDeliveryFeeWithDistance(
          selectedZoneId,
          orderSubtotal,
          deliveryAddress
        );

        setFeeCalculation(calculation);

        // Validate address if coordinates are provided
        if (deliveryAddress?.latitude && deliveryAddress?.longitude) {
          const isValid = await validateAddressInZone(selectedZoneId, deliveryAddress);
          setIsAddressValid(isValid);
          
          if (!isValid) {
            setValidationError('The delivery address is outside the selected zone coverage area.');
            toast.error('Address is outside delivery zone coverage');
          }
        } else {
          setIsAddressValid(null);
        }

      } catch (error) {
        console.error('Error calculating delivery fee:', error);
        setValidationError(error instanceof Error ? error.message : 'Failed to calculate delivery fee');
        toast.error('Failed to calculate delivery fee');
      } finally {
        setIsValidating(false);
      }
    };

    calculateFee();
  }, [selectedZoneId, orderSubtotal, deliveryAddress]);

  return {
    feeCalculation,
    isValidating,
    isAddressValid,
    validationError,
    deliveryFee: feeCalculation?.totalFee || 0,
    freeDeliveryEligible: feeCalculation?.freeDeliveryEligible || false
  };
};