/**
 * Order Update Validation Utilities
 * Provides client-side validation to prevent backend "No valid updates" errors
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: string[];
  cleanedUpdates: Record<string, any>;
}

// Mirror the backend's allowed columns whitelist
export const BACKEND_ALLOWED_FIELDS = [
  'status', 'customer_name', 'customer_phone', 'customer_email',
  'delivery_address', 'special_instructions', 'admin_notes',
  'assigned_rider_id', 'payment_status', 'total_amount',
  'delivery_zone_id', 'order_type', 'internal_notes'
];

export const CRITICAL_FIELDS = [
  'status', 'payment_status', 'customer_email'
];

/**
 * Validates order update payload before sending to backend
 * This prevents the "No valid updates after enhanced cleaning" error
 */
export const validateOrderUpdatePayload = (
  updates: Record<string, any>,
  originalOrder?: Record<string, any>
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: {},
    warnings: [],
    cleanedUpdates: {}
  };

  // Step 1: Filter out unauthorized fields
  Object.entries(updates).forEach(([key, value]) => {
    if (!BACKEND_ALLOWED_FIELDS.includes(key) && key !== 'phone') {
      result.warnings.push(`Field '${key}' is not allowed and will be ignored`);
      return;
    }

    // Step 2: Handle field mapping (phone -> customer_phone)
    if (key === 'phone') {
      if (value && typeof value === 'string' && value.trim() !== '') {
        result.cleanedUpdates.customer_phone = value.trim();
      } else {
        result.warnings.push('Phone field is empty and will be ignored');
      }
      return;
    }

    // Step 3: Validate field values
    if (key === 'assigned_rider_id') {
      // Special case: allow null for unassignment
      if (value === null || value === '' || value === 'unassign') {
        result.cleanedUpdates[key] = null;
      } else if (typeof value === 'string' && value.length > 0) {
        result.cleanedUpdates[key] = value;
      } else {
        result.warnings.push('Invalid assigned_rider_id value, will be ignored');
      }
      return;
    }

    // Step 4: Validate critical fields
    if (CRITICAL_FIELDS.includes(key)) {
      if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        result.errors[key] = `${key} is a critical field and cannot be empty`;
        result.isValid = false;
        return;
      }
    }

    // Step 5: Skip empty non-critical fields
    if ((value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) && 
        !CRITICAL_FIELDS.includes(key)) {
      result.warnings.push(`Empty value for '${key}' will be ignored`);
      return;
    }

    // Step 6: Field-specific validation
    if (key === 'customer_email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        result.errors[key] = 'Invalid email format';
        result.isValid = false;
        return;
      }
    }

    if (key === 'customer_phone' && value) {
      const phoneRegex = /^[+]?[\d\s\-()]{8,}$/;
      if (!phoneRegex.test(value)) {
        result.errors[key] = 'Invalid phone format (minimum 8 characters)';
        result.isValid = false;
        return;
      }
    }

    // Step 7: Only include changed values
    if (originalOrder && originalOrder[key] === value) {
      result.warnings.push(`Field '${key}' has the same value as current, will be ignored`);
      return;
    }

    // Step 8: Add to cleaned updates
    result.cleanedUpdates[key] = value;
  });

  // Final validation: ensure we have meaningful updates
  if (Object.keys(result.cleanedUpdates).length === 0) {
    result.errors._form = 'No valid updates found. Please modify at least one field with a valid, different value.';
    result.isValid = false;
  }

  return result;
};

/**
 * Utility to sanitize a single field value
 */
export const sanitizeFieldValue = (field: string, value: any): any => {
  if (field === 'phone') return sanitizeFieldValue('customer_phone', value);
  
  if (field === 'assigned_rider_id') {
    if (value === null || value === '' || value === 'unassign') return null;
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  
  return value;
};

/**
 * Check if an order update would result in meaningful changes
 */
export const hasValidUpdates = (updates: Record<string, any>): boolean => {
  const validation = validateOrderUpdatePayload(updates);
  return validation.isValid && Object.keys(validation.cleanedUpdates).length > 0;
};