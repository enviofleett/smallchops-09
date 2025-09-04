/**
 * PRODUCTION UTILITY: Promotion Form Validation Helpers
 * Centralized validation logic for production-ready promotion management
 */

export interface PromotionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate promotion configuration based on type and values
 */
export function validatePromotionConfig(
  type: string,
  value?: number,
  minOrder?: number,
  maxDiscount?: number
): PromotionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Type-specific validations
  switch (type) {
    case 'percentage':
      if (value === undefined || value === null) {
        errors.push('Percentage discount value is required');
      } else if (value < 1 || value > 100) {
        errors.push('Percentage must be between 1 and 100');
      }
      
      if (maxDiscount && minOrder && maxDiscount > minOrder) {
        errors.push('Maximum discount cannot exceed minimum order amount');
      }
      
      if (value && value > 50) {
        warnings.push('High percentage discounts (>50%) may significantly impact profit margins');
      }
      break;

    case 'fixed_amount':
      if (value === undefined || value === null) {
        errors.push('Fixed discount amount is required');
      } else if (value <= 0) {
        errors.push('Fixed amount must be greater than 0');
      } else if (value > 100000) {
        errors.push('Fixed amount cannot exceed ₦100,000');
      }
      
      if (minOrder && value && value >= minOrder) {
        warnings.push('Discount amount is very close to minimum order requirement');
      }
      break;

    case 'buy_one_get_one':
      if (value === undefined || value === null) {
        errors.push('BOGO discount percentage is required');
      } else if (value < 0 || value > 100) {
        errors.push('BOGO percentage must be between 0 and 100');
      }
      break;

    case 'free_delivery':
      if (minOrder === undefined || minOrder === null) {
        errors.push('Minimum order amount is required for free delivery promotions');
      } else if (minOrder <= 0) {
        errors.push('Minimum order amount must be greater than 0');
      }
      
      if (minOrder && minOrder < 1000) {
        warnings.push('Low minimum order amounts may increase delivery costs');
      }
      break;

    default:
      errors.push('Invalid promotion type selected');
  }

  // General validations
  if (minOrder && minOrder < 0) {
    errors.push('Minimum order amount cannot be negative');
  }

  if (maxDiscount && maxDiscount < 0) {
    errors.push('Maximum discount amount cannot be negative');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate promotion date range
 */
export function validatePromotionDates(
  startDate?: Date,
  endDate?: Date
): PromotionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (startDate && endDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Check if start date is in the past
    if (startDate < now) {
      errors.push('Start date cannot be in the past');
    }

    // Check if end date is before start date
    if (endDate < startDate) {
      errors.push('End date must be after start date');
    }

    // Check promotion duration
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    if (durationDays > 365) {
      errors.push('Promotion duration cannot exceed 1 year');
    }

    if (durationDays < 1) {
      warnings.push('Very short promotion duration (less than 1 day)');
    }

    if (durationDays > 90) {
      warnings.push('Long-running promotions (>90 days) may impact inventory planning');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate promotion code format
 */
export function validatePromotionCode(code?: string): PromotionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (code) {
    const trimmedCode = code.trim();
    
    if (trimmedCode.length < 3) {
      errors.push('Promotion code must be at least 3 characters');
    }

    if (trimmedCode.length > 20) {
      errors.push('Promotion code cannot exceed 20 characters');
    }

    if (!/^[A-Z0-9]+$/i.test(trimmedCode)) {
      errors.push('Promotion code can only contain letters and numbers');
    }

    // Check for potentially confusing characters
    if (/[0O1Il]/.test(trimmedCode)) {
      warnings.push('Code contains potentially confusing characters (0, O, 1, I, l)');
    }

    // Check for common words that might conflict
    const reservedWords = ['TEST', 'ADMIN', 'NULL', 'VOID', 'ERROR'];
    if (reservedWords.includes(trimmedCode.toUpperCase())) {
      errors.push('Promotion code uses a reserved word');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate a random promotion code
 */
export function generatePromotionCode(): string {
  // Use letters that are less likely to be confused
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let result = '';
  
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Comprehensive promotion validation
 */
export function validateFullPromotion(promotionData: {
  name?: string;
  type?: string;
  value?: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  code?: string;
  valid_from?: Date;
  valid_until?: Date;
}): PromotionValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validate name
  if (!promotionData.name || promotionData.name.trim().length < 2) {
    allErrors.push('Promotion name is required and must be at least 2 characters');
  }

  // Validate configuration
  const configValidation = validatePromotionConfig(
    promotionData.type || '',
    promotionData.value,
    promotionData.min_order_amount,
    promotionData.max_discount_amount
  );
  allErrors.push(...configValidation.errors);
  allWarnings.push(...configValidation.warnings);

  // Validate dates
  const dateValidation = validatePromotionDates(
    promotionData.valid_from,
    promotionData.valid_until
  );
  allErrors.push(...dateValidation.errors);
  allWarnings.push(...dateValidation.warnings);

  // Validate code
  const codeValidation = validatePromotionCode(promotionData.code);
  allErrors.push(...codeValidation.errors);
  allWarnings.push(...codeValidation.warnings);

  // Validate usage limit
  if (promotionData.usage_limit !== undefined) {
    if (promotionData.usage_limit < 1) {
      allErrors.push('Usage limit must be at least 1');
    }
    if (promotionData.usage_limit > 1000000) {
      allErrors.push('Usage limit cannot exceed 1,000,000');
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}