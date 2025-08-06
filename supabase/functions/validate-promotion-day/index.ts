import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromotionValidationRequest {
  promotion_id: string;
  check_date?: string; // Optional, defaults to current date
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { promotion_id, check_date }: PromotionValidationRequest = await req.json();

    if (!promotion_id) {
      return new Response(
        JSON.stringify({ error: 'promotion_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get promotion details
    const { data: promotion, error: promotionError } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', promotion_id)
      .single();

    if (promotionError || !promotion) {
      return new Response(
        JSON.stringify({ error: 'Promotion not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use provided date or current date
    const targetDate = check_date ? new Date(check_date) : new Date();
    
    // Get day name in lowercase (e.g., 'monday', 'tuesday')
    const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Production-ready day validation logic
    const isValidDay = isPromotionValidForDay(promotion, dayName);
    const isActiveStatus = promotion.status === 'active';
    const isWithinDateRange = isWithinValidDateRange(promotion, targetDate);

    // Comprehensive validation result
    const validationResult = {
      promotion_id: promotion.id,
      promotion_name: promotion.name,
      check_date: targetDate.toISOString(),
      day_of_week: dayName,
      applicable_days: promotion.applicable_days || [],
      is_valid_day: isValidDay,
      is_active_status: isActiveStatus,
      is_within_date_range: isWithinDateRange,
      is_promotion_applicable: isValidDay && isActiveStatus && isWithinDateRange,
      validation_details: {
        day_check: isValidDay ? 'PASS' : 'FAIL',
        status_check: isActiveStatus ? 'PASS' : 'FAIL',
        date_range_check: isWithinDateRange ? 'PASS' : 'FAIL'
      }
    };

    // Log validation for audit trail
    await supabase.from('audit_logs').insert({
      action: 'promotion_day_validation',
      category: 'Promotion Processing',
      message: `Day validation for promotion ${promotion.name}: ${validationResult.is_promotion_applicable ? 'VALID' : 'INVALID'}`,
      new_values: validationResult
    });

    return new Response(
      JSON.stringify(validationResult),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Promotion validation error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Production-ready function to check if promotion is valid for specific day
 */
function isPromotionValidForDay(promotion: any, dayName: string): boolean {
  // If no specific days are set, promotion is valid all days
  if (!promotion.applicable_days || promotion.applicable_days.length === 0) {
    return true;
  }

  // Check if current day is in the applicable days list
  return promotion.applicable_days.includes(dayName);
}

/**
 * Check if promotion is within valid date range
 */
function isWithinValidDateRange(promotion: any, checkDate: Date): boolean {
  const validFrom = new Date(promotion.valid_from);
  const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;

  const isAfterStart = checkDate >= validFrom;
  const isBeforeEnd = !validUntil || checkDate <= validUntil;

  return isAfterStart && isBeforeEnd;
}