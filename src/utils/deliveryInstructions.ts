import { sanitizeText } from './htmlSanitizer';

/**
 * Sanitizes and validates delivery instructions
 * @param instructions - Raw delivery instructions input
 * @returns Sanitized instructions or null if invalid
 */
export const sanitizeDeliveryInstructions = (instructions?: string | null): string | null => {
  if (!instructions || typeof instructions !== 'string') {
    return null;
  }

  // Remove HTML tags and trim whitespace
  const cleaned = sanitizeText(instructions).trim();
  
  // Return null if empty after sanitization
  if (!cleaned) {
    return null;
  }

  // Limit to 160 characters for production use
  return cleaned.slice(0, 160);
};

/**
 * Formats delivery instructions for display with appropriate truncation
 * @param instructions - Delivery instructions string
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Formatted string with ellipsis if truncated
 */
export const formatDeliveryInstructionsForDisplay = (
  instructions?: string | null, 
  maxLength: number = 30
): string | null => {
  if (!instructions || typeof instructions !== 'string') {
    return null;
  }

  const sanitized = sanitizeDeliveryInstructions(instructions);
  if (!sanitized) {
    return null;
  }

  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  return `${sanitized.slice(0, maxLength)}...`;
};

/**
 * Extracts delivery instructions from order delivery address safely
 * @param deliveryAddress - Order delivery address object (could be JSON string or object)
 * @returns Delivery instructions or null if not found
 */
export const getDeliveryInstructionsFromAddress = (deliveryAddress: any): string | null => {
  if (!deliveryAddress) {
    return null;
  }

  try {
    // Handle both JSON string and object formats
    const addr = typeof deliveryAddress === 'string' 
      ? JSON.parse(deliveryAddress) 
      : deliveryAddress;
    
    return sanitizeDeliveryInstructions(addr?.delivery_instructions);
  } catch {
    return null;
  }
};