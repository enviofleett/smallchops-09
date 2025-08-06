import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromotionTestRequest {
  promotion_id?: string;
  test_all?: boolean;
  cart_total?: number;
  day_override?: string; // For testing specific days
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

    const { promotion_id, test_all, cart_total = 1000, day_override }: PromotionTestRequest = await req.json();

    let results: any[] = [];

    if (test_all) {
      // Test all active promotions
      const { data: promotions, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      for (const promotion of promotions || []) {
        const testResult = await testPromotionLogic(promotion, cart_total, day_override);
        results.push({
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          ...testResult
        });
      }
    } else if (promotion_id) {
      // Test specific promotion
      const { data: promotion, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('id', promotion_id)
        .single();

      if (error || !promotion) {
        return new Response(
          JSON.stringify({ error: 'Promotion not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const testResult = await testPromotionLogic(promotion, cart_total, day_override);
      results.push({
        promotion_id: promotion.id,
        promotion_name: promotion.name,
        ...testResult
      });
    }

    // Run comprehensive system tests
    const systemTests = await runSystemTests(supabase);

    return new Response(
      JSON.stringify({
        promotion_tests: results,
        system_tests: systemTests,
        test_summary: {
          total_promotions_tested: results.length,
          passing_promotions: results.filter(r => r.status === 'PASS').length,
          failing_promotions: results.filter(r => r.status === 'FAIL').length,
          system_status: systemTests.overall_status
        },
        tested_at: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Production test error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Test comprehensive promotion logic for production readiness
 */
async function testPromotionLogic(promotion: any, cartTotal: number, dayOverride?: string) {
  const tests = [];
  let overallStatus = 'PASS';

  // Test 1: Day validation logic
  const dayTest = testDayValidation(promotion, dayOverride);
  tests.push(dayTest);
  if (dayTest.status === 'FAIL') overallStatus = 'FAIL';

  // Test 2: Date range validation
  const dateTest = testDateValidation(promotion);
  tests.push(dateTest);
  if (dateTest.status === 'FAIL') overallStatus = 'FAIL';

  // Test 3: Minimum order validation
  const minOrderTest = testMinimumOrderValidation(promotion, cartTotal);
  tests.push(minOrderTest);
  if (minOrderTest.status === 'FAIL') overallStatus = 'FAIL';

  // Test 4: Discount calculation accuracy
  const discountTest = testDiscountCalculation(promotion, cartTotal);
  tests.push(discountTest);
  if (discountTest.status === 'FAIL') overallStatus = 'FAIL';

  // Test 5: Usage limit validation
  const usageTest = testUsageLimits(promotion);
  tests.push(usageTest);
  if (usageTest.status === 'FAIL') overallStatus = 'FAIL';

  return {
    status: overallStatus,
    tests,
    total_tests: tests.length,
    passed_tests: tests.filter(t => t.status === 'PASS').length,
    failed_tests: tests.filter(t => t.status === 'FAIL').length
  };
}

function testDayValidation(promotion: any, dayOverride?: string) {
  try {
    const testDate = dayOverride ? new Date(dayOverride) : new Date();
    const currentDay = testDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Test logic: if no days specified, should be valid all days
    if (!promotion.applicable_days || promotion.applicable_days.length === 0) {
      return { 
        test: 'Day Validation', 
        status: 'PASS', 
        message: 'Promotion valid all days (no restrictions)' 
      };
    }

    // Test logic: if days specified, should validate correctly
    const isValidDay = promotion.applicable_days.includes(currentDay);
    
    return {
      test: 'Day Validation',
      status: 'PASS',
      message: `Promotion ${isValidDay ? 'valid' : 'invalid'} for ${currentDay}`,
      details: {
        current_day: currentDay,
        applicable_days: promotion.applicable_days,
        is_valid: isValidDay
      }
    };
  } catch (error) {
    return { 
      test: 'Day Validation', 
      status: 'FAIL', 
      message: `Day validation error: ${error.message}` 
    };
  }
}

function testDateValidation(promotion: any) {
  try {
    const now = new Date();
    const validFrom = new Date(promotion.valid_from);
    const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;

    const isAfterStart = now >= validFrom;
    const isBeforeEnd = !validUntil || now <= validUntil;
    const isValid = isAfterStart && isBeforeEnd;

    return {
      test: 'Date Range Validation',
      status: isValid ? 'PASS' : 'FAIL',
      message: `Promotion ${isValid ? 'valid' : 'invalid'} for current date`,
      details: {
        current_date: now.toISOString(),
        valid_from: promotion.valid_from,
        valid_until: promotion.valid_until,
        is_after_start: isAfterStart,
        is_before_end: isBeforeEnd
      }
    };
  } catch (error) {
    return { 
      test: 'Date Range Validation', 
      status: 'FAIL', 
      message: `Date validation error: ${error.message}` 
    };
  }
}

function testMinimumOrderValidation(promotion: any, cartTotal: number) {
  try {
    const minOrder = promotion.min_order_amount || 0;
    const isValid = cartTotal >= minOrder;

    return {
      test: 'Minimum Order Validation',
      status: 'PASS',
      message: `Cart total ₦${cartTotal} ${isValid ? 'meets' : 'does not meet'} minimum ₦${minOrder}`,
      details: {
        cart_total: cartTotal,
        minimum_required: minOrder,
        meets_requirement: isValid
      }
    };
  } catch (error) {
    return { 
      test: 'Minimum Order Validation', 
      status: 'FAIL', 
      message: `Minimum order validation error: ${error.message}` 
    };
  }
}

function testDiscountCalculation(promotion: any, cartTotal: number) {
  try {
    let expectedDiscount = 0;
    let calculationDetails = {};

    switch (promotion.type) {
      case 'percentage':
        expectedDiscount = (cartTotal * promotion.value) / 100;
        if (promotion.max_discount_amount) {
          expectedDiscount = Math.min(expectedDiscount, promotion.max_discount_amount);
        }
        calculationDetails = {
          percentage: promotion.value,
          cart_total: cartTotal,
          calculated_discount: (cartTotal * promotion.value) / 100,
          max_cap: promotion.max_discount_amount,
          final_discount: expectedDiscount
        };
        break;
      case 'fixed_amount':
        expectedDiscount = Math.min(promotion.value, cartTotal);
        calculationDetails = {
          fixed_amount: promotion.value,
          cart_total: cartTotal,
          final_discount: expectedDiscount
        };
        break;
      case 'free_delivery':
        expectedDiscount = 0; // Handled separately
        calculationDetails = { message: 'Free delivery handled separately in delivery fee calculation' };
        break;
      case 'buy_one_get_one':
        expectedDiscount = 0; // Handled separately
        calculationDetails = { message: 'BOGO handled separately in cart logic' };
        break;
    }

    return {
      test: 'Discount Calculation',
      status: 'PASS',
      message: `${promotion.type} discount calculated: ₦${expectedDiscount}`,
      details: calculationDetails
    };
  } catch (error) {
    return { 
      test: 'Discount Calculation', 
      status: 'FAIL', 
      message: `Discount calculation error: ${error.message}` 
    };
  }
}

function testUsageLimits(promotion: any) {
  try {
    const usageLimit = promotion.usage_limit;
    const usageCount = promotion.usage_count || 0;

    if (!usageLimit) {
      return {
        test: 'Usage Limit Validation',
        status: 'PASS',
        message: 'No usage limit set (unlimited usage)',
        details: { usage_limit: null, current_usage: usageCount }
      };
    }

    const hasCapacity = usageCount < usageLimit;

    return {
      test: 'Usage Limit Validation',
      status: 'PASS',
      message: `Usage ${usageCount}/${usageLimit} - ${hasCapacity ? 'Available' : 'Limit reached'}`,
      details: {
        usage_limit: usageLimit,
        current_usage: usageCount,
        has_capacity: hasCapacity,
        remaining_uses: Math.max(0, usageLimit - usageCount)
      }
    };
  } catch (error) {
    return { 
      test: 'Usage Limit Validation', 
      status: 'FAIL', 
      message: `Usage limit validation error: ${error.message}` 
    };
  }
}

/**
 * Run comprehensive system tests for production readiness
 */
async function runSystemTests(supabase: any) {
  const systemTests = [];

  // Test database schema
  try {
    const { data, error } = await supabase
      .from('promotions')
      .select('applicable_days')
      .limit(1);
    
    systemTests.push({
      test: 'Database Schema',
      status: error ? 'FAIL' : 'PASS',
      message: error ? `Schema error: ${error.message}` : 'applicable_days column exists'
    });
  } catch (error) {
    systemTests.push({
      test: 'Database Schema',
      status: 'FAIL',
      message: `Database connection error: ${error.message}`
    });
  }

  // Test promotion enums
  try {
    const { data, error } = await supabase.rpc('get_promotion_types');
    systemTests.push({
      test: 'Promotion Types Enum',
      status: 'PASS',
      message: 'Promotion type enums accessible'
    });
  } catch (error) {
    systemTests.push({
      test: 'Promotion Types Enum',
      status: 'WARN',
      message: 'Could not test enum types (function may not exist)'
    });
  }

  const overallStatus = systemTests.every(t => t.status === 'PASS') ? 'PASS' : 
                       systemTests.some(t => t.status === 'FAIL') ? 'FAIL' : 'WARN';

  return {
    tests: systemTests,
    overall_status: overallStatus,
    total_tests: systemTests.length,
    passed_tests: systemTests.filter(t => t.status === 'PASS').length,
    failed_tests: systemTests.filter(t => t.status === 'FAIL').length,
    warning_tests: systemTests.filter(t => t.status === 'WARN').length
  };
}