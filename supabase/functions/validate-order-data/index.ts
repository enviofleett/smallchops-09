import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface OrderValidationData {
  fulfillment_type: 'delivery' | 'pickup';
  delivery_zone_id?: string;
  delivery_address?: any;
  pickup_point_id?: string;
  order_items: any[];
  total_amount: number;
  delivery_fee: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const orderData: OrderValidationData = await req.json();
    console.log('🔍 Validating order data:', orderData);

    const validationResult = await validateOrderData(supabase, orderData);

    return new Response(
      JSON.stringify(validationResult),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Order validation error:', error);
    return new Response(
      JSON.stringify({ 
        isValid: false, 
        errors: ['Validation service error'],
        warnings: []
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

async function validateOrderData(
  supabase: any, 
  orderData: OrderValidationData
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate fulfillment type
  if (!orderData.fulfillment_type || !['delivery', 'pickup'].includes(orderData.fulfillment_type)) {
    errors.push('Invalid fulfillment type');
  }

  // Validate delivery-specific data
  if (orderData.fulfillment_type === 'delivery') {
    if (!orderData.delivery_zone_id) {
      errors.push('Delivery zone is required for delivery orders');
    } else {
      // Validate delivery zone exists and has valid fee configuration
      const { data: zone, error: zoneError } = await supabase
        .from('delivery_zones')
        .select(`
          *,
          delivery_fees(*)
        `)
        .eq('id', orderData.delivery_zone_id)
        .single();

      if (zoneError || !zone) {
        errors.push('Invalid delivery zone selected');
      } else if (!zone.delivery_fees || zone.delivery_fees.length === 0) {
        errors.push('Selected delivery zone has no fee configuration');
      } else {
        const fee = zone.delivery_fees[0];
        
        // Validate delivery fee calculation
        const expectedFee = fee.min_order_for_free_delivery && 
          orderData.total_amount - orderData.delivery_fee >= fee.min_order_for_free_delivery 
          ? 0 
          : fee.base_fee;

        if (Math.abs(orderData.delivery_fee - expectedFee) > 0.01) {
          errors.push(`Delivery fee calculation error. Expected ₦${expectedFee.toFixed(2)}, received ₦${orderData.delivery_fee.toFixed(2)}`);
        }

        // Validate delivery address
        if (!orderData.delivery_address) {
          errors.push('Delivery address is required');
        } else {
          if (!orderData.delivery_address.address_line_1?.trim()) {
            errors.push('Street address is required');
          }
          if (!orderData.delivery_address.city?.trim()) {
            errors.push('City is required');
          }
          if (!orderData.delivery_address.state?.trim()) {
            errors.push('State is required');
          }
        }
      }
    }
  }

  // Validate pickup-specific data
  if (orderData.fulfillment_type === 'pickup') {
    if (!orderData.pickup_point_id) {
      errors.push('Pickup point is required for pickup orders');
    } else {
      // Validate pickup point exists and is active
      const { data: pickupPoint, error: pickupError } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('id', orderData.pickup_point_id)
        .eq('is_active', true)
        .single();

      if (pickupError || !pickupPoint) {
        errors.push('Invalid pickup point selected');
      }
    }

    // Ensure no delivery fee for pickup orders
    if (orderData.delivery_fee > 0) {
      errors.push('Pickup orders should not have delivery fees');
    }
  }

  // Validate order items
  if (!orderData.order_items || orderData.order_items.length === 0) {
    errors.push('Order must contain at least one item');
  } else {
    // Validate each item
    for (let i = 0; i < orderData.order_items.length; i++) {
      const item = orderData.order_items[i];
      
      if (!item.product_id) {
        errors.push(`Item ${i + 1}: Product ID is required`);
        continue;
      }

      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${i + 1}: Valid quantity is required`);
      }

      if (!item.unit_price || item.unit_price <= 0) {
        errors.push(`Item ${i + 1}: Valid unit price is required`);
      }

      // Check if product exists (skip for custom bundles)
      const isCustomBundle = !item.product_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      if (!isCustomBundle) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name, price, stock_quantity, status')
          .eq('id', item.product_id)
          .single();

        if (productError || !product) {
          errors.push(`Item ${i + 1}: Product not found`);
        } else if (product.status !== 'active') {
          errors.push(`Item ${i + 1}: Product is not available`);
        } else if (product.stock_quantity < item.quantity) {
          warnings.push(`Item ${i + 1}: Limited stock available (${product.stock_quantity} remaining)`);
        }

        // Check for significant price discrepancies
        if (product && Math.abs(product.price - item.unit_price) > product.price * 0.1) {
          warnings.push(`Item ${i + 1}: Price may have changed since adding to cart`);
        }
      }
    }
  }

  // Validate total amount
  if (!orderData.total_amount || orderData.total_amount <= 0) {
    errors.push('Valid total amount is required');
  }

  // Log validation audit
  await supabase.from('audit_logs').insert({
    action: 'order_validation_performed',
    category: 'Order Management',
    message: `Order validation completed: ${errors.length} errors, ${warnings.length} warnings`,
    new_values: {
      validation_result: {
        isValid: errors.length === 0,
        error_count: errors.length,
        warning_count: warnings.length,
        fulfillment_type: orderData.fulfillment_type,
        has_delivery_zone: !!orderData.delivery_zone_id,
        item_count: orderData.order_items?.length || 0
      }
    }
  });

  console.log(`✅ Validation complete: ${errors.length} errors, ${warnings.length} warnings`);

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}