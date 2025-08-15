import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { DeliveryZoneWithFee } from '@/api/delivery';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface AddressValidationData {
  address_line_1: string;
  city: string;
  state: string;
  selectedZoneId?: string;
}

export const useDeliveryValidation = () => {
  const [isValidating, setIsValidating] = useState(false);

  const validateDeliveryZoneSelection = useCallback((
    zoneId: string | undefined,
    zones: DeliveryZoneWithFee[]
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!zoneId) {
      errors.push('Please select a delivery zone to continue');
      return { isValid: false, errors, warnings };
    }

    const selectedZone = zones.find(z => z.id === zoneId);
    if (!selectedZone) {
      errors.push('Selected delivery zone is invalid. Please select a valid zone.');
      return { isValid: false, errors, warnings };
    }

    if (!selectedZone.delivery_fees) {
      errors.push('Selected delivery zone has no fee configuration. Please contact support.');
      return { isValid: false, errors, warnings };
    }

    // Validate fee structure
    if (selectedZone.delivery_fees.base_fee < 0) {
      errors.push('Invalid delivery fee configuration. Please contact support.');
      return { isValid: false, errors, warnings };
    }

    // Check for reasonable fee limits
    if (selectedZone.delivery_fees.base_fee > 20000) {
      warnings.push(`High delivery fee (₦${selectedZone.delivery_fees.base_fee.toFixed(2)}). Please verify this is correct.`);
    }

    return { isValid: true, errors, warnings };
  }, []);

  const validateDeliveryAddress = useCallback((
    address: AddressValidationData,
    selectedZone?: DeliveryZoneWithFee
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic address validation
    if (!address.address_line_1?.trim()) {
      errors.push('Delivery address is required');
    }

    if (!address.city?.trim()) {
      errors.push('City is required');
    }

    if (!address.state?.trim()) {
      errors.push('State is required');
    }

    // Address length validation
    if (address.address_line_1 && address.address_line_1.length < 10) {
      warnings.push('Please provide a more detailed address for accurate delivery');
    }

    // Zone-address matching (basic validation)
    if (selectedZone && address.city) {
      const cityLower = address.city.toLowerCase();
      const zoneName = selectedZone.name.toLowerCase();
      
      // Check if address mentions a different area than selected zone
      const commonAreas = ['abuja', 'fct', 'garki', 'wuse', 'maitama', 'asokoro', 'gwarinpa'];
      const addressMentionsArea = commonAreas.some(area => 
        address.address_line_1.toLowerCase().includes(area) && 
        !zoneName.includes(area)
      );

      if (addressMentionsArea) {
        warnings.push('Your address may not match the selected delivery zone. Please verify the zone is correct.');
      }
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings 
    };
  }, []);

  const validateDeliveryFeeCalculation = useCallback((
    zone: DeliveryZoneWithFee,
    orderSubtotal: number,
    calculatedFee: number
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!zone.delivery_fees) {
      errors.push('Zone has no fee configuration');
      return { isValid: false, errors, warnings };
    }

    const { base_fee, min_order_for_free_delivery } = zone.delivery_fees;

    // Validate fee calculation
    const expectedFee = min_order_for_free_delivery && orderSubtotal >= min_order_for_free_delivery 
      ? 0 
      : base_fee;

    if (Math.abs(calculatedFee - expectedFee) > 0.01) {
      errors.push(`Delivery fee calculation error. Expected ₦${expectedFee.toFixed(2)}, got ₦${calculatedFee.toFixed(2)}`);
      return { isValid: false, errors, warnings };
    }

    // Check for free delivery eligibility
    if (min_order_for_free_delivery && orderSubtotal < min_order_for_free_delivery) {
      const remaining = min_order_for_free_delivery - orderSubtotal;
      warnings.push(`Add ₦${remaining.toFixed(2)} more to qualify for free delivery!`);
    }

    return { isValid: true, errors, warnings };
  }, []);

  const performCompleteValidation = useCallback(async (
    zoneId: string | undefined,
    zones: DeliveryZoneWithFee[],
    address: AddressValidationData,
    orderSubtotal: number,
    calculatedFee: number
  ): Promise<ValidationResult> => {
    setIsValidating(true);

    try {
      const zoneValidation = validateDeliveryZoneSelection(zoneId, zones);
      if (!zoneValidation.isValid) {
        return zoneValidation;
      }

      const selectedZone = zones.find(z => z.id === zoneId);
      
      const addressValidation = validateDeliveryAddress(address, selectedZone);
      const feeValidation = selectedZone 
        ? validateDeliveryFeeCalculation(selectedZone, orderSubtotal, calculatedFee)
        : { isValid: true, errors: [], warnings: [] };

      const allErrors = [
        ...zoneValidation.errors,
        ...addressValidation.errors,
        ...feeValidation.errors
      ];

      const allWarnings = [
        ...zoneValidation.warnings,
        ...addressValidation.warnings,
        ...feeValidation.warnings
      ];

      return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings
      };

    } finally {
      setIsValidating(false);
    }
  }, [validateDeliveryZoneSelection, validateDeliveryAddress, validateDeliveryFeeCalculation]);

  const showValidationResults = useCallback((result: ValidationResult) => {
    // Show errors
    result.errors.forEach(error => {
      toast.error(error);
    });

    // Show warnings
    result.warnings.forEach(warning => {
      toast.warning(warning);
    });
  }, []);

  return {
    isValidating,
    validateDeliveryZoneSelection,
    validateDeliveryAddress,
    validateDeliveryFeeCalculation,
    performCompleteValidation,
    showValidationResults
  };
};