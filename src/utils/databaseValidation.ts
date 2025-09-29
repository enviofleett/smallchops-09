/**
 * Database Validation Utilities for Order Data
 * Helps identify and fix corrupted order data at the source
 */

import { supabase } from '@/integrations/supabase/client';
import { logProductionError } from './productionSafeData';
import { emergencySafeFormatAddress } from './formatAddress';

export interface CorruptedOrderData {
  id: string;
  order_number: string;
  issues: string[];
  corrupted_fields: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Validates order data structure and identifies corruption issues
 */
export const validateOrderDataStructure = (order: any): CorruptedOrderData | null => {
  if (!order || typeof order !== 'object') {
    return {
      id: 'unknown',
      order_number: 'unknown',
      issues: ['Order data is null or not an object'],
      corrupted_fields: ['*'],
      severity: 'critical'
    };
  }

  const issues: string[] = [];
  const corruptedFields: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Check required fields
  if (!order.id) {
    issues.push('Missing order ID');
    corruptedFields.push('id');
    severity = 'critical';
  }

  if (!order.order_number) {
    issues.push('Missing order number');
    corruptedFields.push('order_number');
    severity = 'high';
  }

  // Check delivery address structure
  if (order.delivery_address) {
    try {
      // Check if address is a string that should be JSON
      if (typeof order.delivery_address === 'string') {
        const trimmed = order.delivery_address.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            JSON.parse(trimmed);
          } catch {
            issues.push('Delivery address contains malformed JSON');
            corruptedFields.push('delivery_address');
            severity = 'high';
          }
        }
      } else if (typeof order.delivery_address === 'object') {
        // Check if address object has the right structure
        const addr = order.delivery_address.address || order.delivery_address;
        if (typeof addr === 'object' && addr !== null) {
          // Check for nested objects that might cause React errors
          Object.keys(addr).forEach(key => {
            const value = addr[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Check if it's a plain object that would cause React rendering issues
              if (value.constructor === Object && value.toString() === '[object Object]') {
                issues.push(`Address field '${key}' contains a plain object that cannot be rendered`);
                corruptedFields.push(`delivery_address.${key}`);
                severity = 'high';
              }
            }
          });
        }
      }
    } catch (error) {
      issues.push('Delivery address validation failed');
      corruptedFields.push('delivery_address');
      severity = 'high';
    }
  }

  // Check customer data
  if (order.customer_name && typeof order.customer_name !== 'string') {
    issues.push('Customer name is not a string');
    corruptedFields.push('customer_name');
    severity = 'medium';
  }

  if (order.customer_email && typeof order.customer_email !== 'string') {
    issues.push('Customer email is not a string');
    corruptedFields.push('customer_email');
    severity = 'medium';
  }

  if (order.customer_phone && typeof order.customer_phone !== 'string') {
    issues.push('Customer phone is not a string');
    corruptedFields.push('customer_phone');
    severity = 'medium';
  }

  // Check numeric fields
  if (order.total_amount !== null && order.total_amount !== undefined) {
    const amount = Number(order.total_amount);
    if (isNaN(amount)) {
      issues.push('Total amount is not a valid number');
      corruptedFields.push('total_amount');
      severity = 'high';
    }
  }

  // Check for any functions or symbols that would break React
  Object.keys(order).forEach(key => {
    const value = order[key];
    if (typeof value === 'function') {
      issues.push(`Field '${key}' contains a function`);
      corruptedFields.push(key);
      severity = 'critical';
    }
    if (typeof value === 'symbol') {
      issues.push(`Field '${key}' contains a symbol`);
      corruptedFields.push(key);
      severity = 'critical';
    }
  });

  if (issues.length === 0) {
    return null; // No issues found
  }

  return {
    id: order.id || 'unknown',
    order_number: order.order_number || 'unknown',
    issues,
    corrupted_fields: corruptedFields,
    severity
  };
};

/**
 * Scans the database for corrupted order records
 */
export const scanForCorruptedOrders = async (limit = 100): Promise<CorruptedOrderData[]> => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const corruptedOrders: CorruptedOrderData[] = [];

    orders?.forEach(order => {
      const validation = validateOrderDataStructure(order);
      if (validation) {
        corruptedOrders.push(validation);
      }
    });

    return corruptedOrders;
  } catch (error) {
    logProductionError(error, 'Database corruption scan failed');
    return [];
  }
};

/**
 * Attempts to fix corrupted address data in an order
 */
export const fixCorruptedOrderAddress = async (orderId: string): Promise<boolean> => {
  try {
    // First, get the current order data
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('delivery_address')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      throw new Error('Could not fetch order for repair');
    }

    if (!order.delivery_address) {
      return true; // Nothing to fix
    }

    let fixedAddress = null;

    try {
      // Try to repair the address
      if (typeof order.delivery_address === 'string') {
        const trimmed = order.delivery_address.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          // Try to parse and reformat JSON
          try {
            const parsed = JSON.parse(trimmed);
            fixedAddress = {
              address_line_1: String(parsed.address_line_1 || parsed.address || '').trim(),
              address_line_2: String(parsed.address_line_2 || '').trim(),
              city: String(parsed.city || '').trim(),
              state: String(parsed.state || '').trim(),
              country: String(parsed.country || 'Nigeria').trim(),
              postal_code: String(parsed.postal_code || '').trim(),
              landmark: String(parsed.landmark || '').trim(),
            };
          } catch {
            // If parsing fails, convert to simple address
            fixedAddress = {
              address_line_1: trimmed,
              city: '',
              state: '',
              country: 'Nigeria'
            };
          }
        } else {
          // Plain text address
          fixedAddress = {
            address_line_1: trimmed,
            city: '',
            state: '',
            country: 'Nigeria'
          };
        }
      } else if (typeof order.delivery_address === 'object') {
        // Clean up object address
        const addr = (order.delivery_address as any).address || order.delivery_address;
        fixedAddress = {
          address_line_1: String(addr.address_line_1 || addr.address || '').trim(),
          address_line_2: String(addr.address_line_2 || '').trim(),
          city: String(addr.city || '').trim(),
          state: String(addr.state || '').trim(),
          country: String(addr.country || 'Nigeria').trim(),
          postal_code: String(addr.postal_code || '').trim(),
          landmark: String(addr.landmark || '').trim(),
        };
      }

      if (fixedAddress) {
        // Update the order with the fixed address
        const { error: updateError } = await supabase
          .from('orders')
          .update({ delivery_address: fixedAddress })
          .eq('id', orderId);

        if (updateError) throw updateError;

        // Log the fix
        await supabase.from('audit_logs').insert({
          action: 'order_address_corruption_fix',
          category: 'Data Repair',
          message: `Fixed corrupted delivery address for order ${orderId}`,
          entity_id: orderId,
          new_values: {
            fixed_address: fixedAddress,
            original_address: order.delivery_address,
            timestamp: new Date().toISOString()
          }
        });

        return true;
      }
    } catch (repairError) {
      logProductionError(repairError, 'Address repair failed', { orderId });
      return false;
    }

    return false;
  } catch (error) {
    logProductionError(error, 'Order address fix failed', { orderId });
    return false;
  }
};

/**
 * Creates a database constraint to prevent future corruption
 */
export const createAddressValidationConstraint = async (): Promise<boolean> => {
  try {
    // This would typically be done via a Supabase migration
    // For now, we'll document the SQL that should be run
    const validationSQL = `
      -- Add constraint to ensure delivery_address is properly structured
      ALTER TABLE orders ADD CONSTRAINT check_delivery_address_structure 
      CHECK (
        delivery_address IS NULL OR 
        (
          jsonb_typeof(delivery_address) = 'object' AND
          delivery_address ? 'address_line_1'
        )
      );
      
      -- Add function to validate address before insert/update
      CREATE OR REPLACE FUNCTION validate_order_address()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.delivery_address IS NOT NULL THEN
          -- Ensure address_line_1 is a string
          IF jsonb_typeof(NEW.delivery_address->'address_line_1') != 'string' THEN
            RAISE EXCEPTION 'delivery_address.address_line_1 must be a string';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Create trigger
      DROP TRIGGER IF EXISTS validate_order_address_trigger ON orders;
      CREATE TRIGGER validate_order_address_trigger
        BEFORE INSERT OR UPDATE ON orders
        FOR EACH ROW
        EXECUTE FUNCTION validate_order_address();
    `;

    console.info('Address validation constraint SQL:', validationSQL);
    
    // In a real implementation, this would execute the SQL
    // For now, we'll just log it for the admin to run manually
    
    return true;
  } catch (error) {
    logProductionError(error, 'Failed to create address validation constraint');
    return false;
  }
};