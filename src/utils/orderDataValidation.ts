/**
 * Order Data Validation Schema for Production Safety
 * Prevents React rendering errors by validating data structure before rendering
 */

import { z } from 'zod';
import { emergencySafeFormatAddress } from './formatAddress';
import { safeStringify, logProductionError } from './productionSafeData';

// Safe string schema that handles null/undefined
const safeString = z.preprocess(
  (val) => val === null || val === undefined ? '' : String(val),
  z.string()
);

// Safe number schema that handles null/undefined and invalid numbers
const safeNumber = z.preprocess(
  (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  },
  z.number()
);

// Address validation schema
export const DeliveryAddressSchema = z.object({
  address_line_1: safeString.optional(),
  address_line_2: safeString.optional(),
  city: safeString.optional(),
  state: safeString.optional(),
  country: safeString.optional(),
  postal_code: safeString.optional(),
  landmark: safeString.optional(),
}).optional().nullable();

// Order item validation schema
export const OrderItemSchema = z.object({
  id: safeString,
  product_name: safeString,
  quantity: safeNumber.default(1),
  unit_price: safeNumber.default(0),
  total_price: safeNumber.default(0),
  special_instructions: safeString.optional().nullable(),
  product_id: safeString.optional(),
  product: z.object({
    id: safeString,
    name: safeString,
    features: z.array(safeString).optional(),
  }).optional().nullable(),
});

// Main order validation schema
export const OrderDataSchema = z.object({
  id: safeString,
  order_number: safeString,
  status: safeString.default('pending'),
  payment_status: safeString.default('pending'),
  paid_at: safeString.optional().nullable(),
  total_amount: safeNumber.default(0),
  subtotal: safeNumber.optional().default(0),
  delivery_fee: safeNumber.optional().default(0),
  order_time: safeString,
  customer_id: safeString.optional().nullable(),
  customer_email: safeString.optional().nullable(),
  customer_phone: safeString.optional().nullable(),
  customer_name: safeString.optional().nullable(),
  payment_method: safeString.optional().nullable(),
  payment_reference: safeString.optional().nullable(),
  order_type: z.enum(['delivery', 'pickup']).default('delivery'),
  delivery_address: z.any().optional().nullable(), // We'll handle this separately for safety
  pickup_point_id: safeString.optional().nullable(),
  special_instructions: safeString.optional().nullable(),
  delivery_notes: safeString.optional().nullable(),
  estimated_delivery_date: safeString.optional().nullable(),
  order_items: z.array(OrderItemSchema).default([]),
});

export type ValidatedOrderData = z.infer<typeof OrderDataSchema>;
export type ValidatedOrderItem = z.infer<typeof OrderItemSchema>;
export type ValidatedDeliveryAddress = z.infer<typeof DeliveryAddressSchema>;

/**
 * Validates and sanitizes order data to prevent React rendering errors
 */
export const validateOrderData = (rawOrderData: any): ValidatedOrderData | null => {
  try {
    // First, sanitize the delivery address safely
    let sanitizedData = { ...rawOrderData };
    
    if (sanitizedData.delivery_address) {
      try {
        // Ensure delivery address is properly formatted and safe for rendering
        sanitizedData.delivery_address = sanitizeDeliveryAddress(sanitizedData.delivery_address);
      } catch (addressError) {
        console.warn('Address sanitization failed, using fallback:', addressError);
        sanitizedData.delivery_address = null;
      }
    }

    // Validate the main order structure
    const validated = OrderDataSchema.parse(sanitizedData);
    
    return validated;
  } catch (error) {
    logProductionError(error, 'Order data validation failed', {
      orderId: rawOrderData?.id,
      orderNumber: rawOrderData?.order_number,
      rawDataStructure: Object.keys(rawOrderData || {})
    });
    
    // Return null to indicate validation failure
    return null;
  }
};

/**
 * Sanitizes delivery address data to prevent rendering errors
 */
export const sanitizeDeliveryAddress = (address: any): ValidatedDeliveryAddress => {
  if (!address) return null;
  
  try {
    // Handle string addresses (JSON or plain text)
    if (typeof address === 'string') {
      const trimmed = address.trim();
      if (!trimmed) return null;
      
      // Try to parse JSON
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          return sanitizeDeliveryAddress(parsed);
        } catch {
          // If JSON parsing fails, treat as plain text address
          return {
            address_line_1: trimmed,
            city: '',
            state: '',
            country: 'Nigeria',
          };
        }
      } else {
        return {
          address_line_1: trimmed,
          city: '',
          state: '',
          country: 'Nigeria',
        };
      }
    }
    
    // Handle object addresses
    if (typeof address === 'object' && address !== null && !Array.isArray(address)) {
      // Handle nested address structure
      const addr = address.address ? address.address : address;
      
      return DeliveryAddressSchema.parse({
        address_line_1: safeStringify(addr.address_line_1 || addr.address || ''),
        address_line_2: safeStringify(addr.address_line_2 || ''),
        city: safeStringify(addr.city || ''),
        state: safeStringify(addr.state || ''),
        country: safeStringify(addr.country || 'Nigeria'),
        postal_code: safeStringify(addr.postal_code || ''),
        landmark: safeStringify(addr.landmark || ''),
      });
    }
    
    return null;
  } catch (error) {
    console.warn('Address sanitization failed:', error);
    return null;
  }
};

/**
 * Creates a safe fallback order object for error recovery
 */
export const createFallbackOrderData = (originalData?: any): ValidatedOrderData => {
  const now = new Date().toISOString();
  
  return {
    id: originalData?.id || 'unknown',
    order_number: originalData?.order_number || 'N/A',
    status: 'pending',
    payment_status: 'pending',
    paid_at: null,
    total_amount: Number(originalData?.total_amount) || 0,
    subtotal: Number(originalData?.subtotal) || 0,
    delivery_fee: Number(originalData?.delivery_fee) || 0,
    order_time: originalData?.order_time || now,
    customer_id: null,
    customer_email: safeStringify(originalData?.customer_email),
    customer_phone: safeStringify(originalData?.customer_phone),
    customer_name: safeStringify(originalData?.customer_name),
    payment_method: null,
    payment_reference: null,
    order_type: 'delivery',
    delivery_address: null,
    pickup_point_id: null,
    special_instructions: null,
    delivery_notes: null,
    estimated_delivery_date: null,
    order_items: [],
  };
};

/**
 * Validates that data is safe for React rendering
 */
export const validateForReactRendering = (data: any, componentName: string): boolean => {
  try {
    // Check for objects that would cause "Objects are not valid as a React child"
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      // Check if it's a plain object that would be rendered directly
      if (data.constructor === Object && !data.toString) {
        console.warn(`⚠️ Plain object detected in ${componentName}, potential React error`);
        return false;
      }
    }
    
    // Check for functions
    if (typeof data === 'function') {
      console.error(`❌ Function cannot be rendered in ${componentName}`);
      return false;
    }
    
    // Check for symbols
    if (typeof data === 'symbol') {
      console.error(`❌ Symbol cannot be rendered in ${componentName}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Validation failed in ${componentName}:`, error);
    return false;
  }
};

/**
 * Safe getter for nested object properties
 */
export const safeGet = (obj: any, path: string, fallback: any = null): any => {
  try {
    return path.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : fallback;
    }, obj);
  } catch {
    return fallback;
  }
};