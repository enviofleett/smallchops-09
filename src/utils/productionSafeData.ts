/**
 * Production-Safe Data Utilities
 * Prevents React rendering errors and ensures data integrity in live production
 */

import { emergencySafeFormatAddress } from './formatAddress';

/**
 * Safely converts any value to a display-safe string
 * Prevents React error #31 "Objects are not valid as a React child"
 */
export const safeStringify = (value: any): string => {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'string') return value;
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (typeof value === 'object') {
    // Special handling for address objects
    if (value.address_line_1 || value.city || value.address) {
      return emergencySafeFormatAddress(value);
    }
    
    // For other objects, provide safe fallback
    try {
      // Only show object properties if it's a simple object
      const keys = Object.keys(value);
      if (keys.length <= 3) {
        return keys.map(key => `${key}: ${safeStringify(value[key])}`).join(', ');
      }
      return '[Complex Object]';
    } catch {
      return '[Object]';
    }
  }
  
  return String(value);
};

/**
 * Sanitizes order data to prevent rendering errors
 * Ensures all nested objects are safely convertible to strings
 */
export const sanitizeOrderData = (order: any) => {
  if (!order || typeof order !== 'object') return order;
  
  try {
    return {
      ...order,
      // Ensure delivery_address is safe
      delivery_address: order.delivery_address ? {
        ...order.delivery_address,
        _formatted: emergencySafeFormatAddress(order.delivery_address)
      } : null,
      
      // Ensure all string fields are actually strings
      customer_name: safeStringify(order.customer_name),
      customer_email: safeStringify(order.customer_email),
      customer_phone: safeStringify(order.customer_phone),
      order_number: safeStringify(order.order_number),
      status: safeStringify(order.status),
      
      // Ensure numeric fields are numbers
      total_amount: Number(order.total_amount) || 0,
      subtotal: Number(order.subtotal) || 0,
      delivery_fee: Number(order.delivery_fee) || 0,
      
      // Ensure arrays are arrays
      order_items: Array.isArray(order.order_items) ? order.order_items : [],
      
      // Safe special instructions
      special_instructions: safeStringify(order.special_instructions),
    };
  } catch (error) {
    console.error('Order data sanitization failed:', error);
    return {
      ...order,
      _sanitization_error: true,
      _original_data: JSON.stringify(order).substring(0, 200) + '...'
    };
  }
};

/**
 * Production error logger with sanitization
 * Safely logs errors without exposing sensitive data
 */
export const logProductionError = (error: any, context: string, additionalData?: any) => {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    context,
    error: {
      message: safeStringify(error?.message),
      name: safeStringify(error?.name),
      stack: error?.stack ? error.stack.substring(0, 500) : 'No stack trace'
    },
    url: typeof window !== 'undefined' ? window.location.href : 'N/A',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    additionalData: additionalData ? safeStringify(additionalData) : null
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('🚨 Production Error:', errorInfo);
  }
  
  // In a real app, this would send to monitoring service
  // Example: Sentry, LogRocket, DataDog, etc.
  try {
    // Placeholder for monitoring service integration
    // await sendToMonitoringService(errorInfo);
    
    // For now, store in localStorage for debugging
    if (typeof window !== 'undefined') {
      const existingErrors = JSON.parse(localStorage.getItem('production_errors') || '[]');
      existingErrors.push(errorInfo);
      // Keep only last 10 errors
      const recentErrors = existingErrors.slice(-10);
      localStorage.setItem('production_errors', JSON.stringify(recentErrors));
    }
  } catch (loggingError) {
    console.warn('Failed to log production error:', loggingError);
  }
  
  return errorInfo;
};

/**
 * React component data validator
 * Ensures data is safe for React rendering
 */
export const validateComponentData = (data: any, componentName: string): boolean => {
  try {
    // Check for common React error patterns
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      // Check if object has toString method that returns [object Object]
      if (data.toString() === '[object Object]') {
        console.warn(`⚠️ Potential React rendering issue in ${componentName}: plain object detected`, data);
        return false;
      }
    }
    
    // Check for functions (should not be rendered)
    if (typeof data === 'function') {
      console.error(`❌ Invalid data in ${componentName}: function cannot be rendered`, data);
      return false;
    }
    
    // Check for symbols
    if (typeof data === 'symbol') {
      console.error(`❌ Invalid data in ${componentName}: symbol cannot be rendered`, data);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Data validation failed in ${componentName}:`, error);
    return false;
  }
};

/**
 * Emergency data recovery utility
 * Attempts to recover usable data from corrupted objects
 */
export const emergencyDataRecovery = (corruptedData: any, expectedType: 'string' | 'number' | 'object' | 'array') => {
  try {
    switch (expectedType) {
      case 'string':
        return safeStringify(corruptedData);
      
      case 'number':
        const num = Number(corruptedData);
        return isNaN(num) ? 0 : num;
      
      case 'array':
        return Array.isArray(corruptedData) ? corruptedData : [];
      
      case 'object':
        return (typeof corruptedData === 'object' && corruptedData !== null) ? corruptedData : {};
      
      default:
        return corruptedData;
    }
  } catch (error) {
    console.error('Emergency data recovery failed:', error);
    
    // Last resort fallbacks
    switch (expectedType) {
      case 'string': return 'Data unavailable';
      case 'number': return 0;
      case 'array': return [];
      case 'object': return {};
      default: return null;
    }
  }
};
