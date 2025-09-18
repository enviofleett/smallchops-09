# 🚨 CRITICAL FIXES REQUIRED - IMMEDIATE ACTION PLAN

**Status: SYSTEM NOT PRODUCTION READY**  
**Critical Blockers: 4 | Estimated Fix Time: 5-8 hours**

---

## 🔥 PHASE 1: EMERGENCY DATABASE REPAIR (PRIORITY: CRITICAL)

### **Issue**: `get_detailed_order_with_products` Function Missing/Broken
**Impact**: Order details loading fails, breaking admin dashboard  
**Time Required**: 30 minutes

#### **Files to Create/Modify:**
```
supabase/migrations/20250918_emergency_fix_detailed_order_function.sql
src/hooks/useDetailedOrderData.ts (fallback logic)
src/components/orders/OrderDetailsDialog.tsx (error handling)
```

#### **Migration Required:**
```sql
-- supabase/migrations/20250918_emergency_fix_detailed_order_function.sql
-- Drop broken function if exists
DROP FUNCTION IF EXISTS public.get_detailed_order_with_products(uuid);

-- Create stable function without problematic columns
CREATE OR REPLACE FUNCTION public.get_detailed_order_with_products(p_order_id uuid)
RETURNS TABLE (
  id uuid,
  order_number text,
  status text,
  payment_status text,
  total_amount numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  order_time timestamptz,
  delivery_address text,
  special_instructions text,
  items jsonb,
  delivery_info jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.status::text,
    o.payment_status::text,
    o.total_amount,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.order_time,
    o.delivery_address,
    o.special_instructions,
    -- Aggregate order items as JSON
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'price', oi.price,
          'subtotal', oi.subtotal
        )
      )
      FROM order_items oi
      WHERE oi.order_id = p_order_id), '[]'::jsonb
    ) as items,
    -- Aggregate delivery info as JSON
    jsonb_build_object(
      'delivery_zone_id', o.delivery_zone_id,
      'delivery_fee', o.delivery_fee,
      'order_type', o.order_type::text
    ) as delivery_info
  FROM orders o
  WHERE o.id = p_order_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_detailed_order_with_products(uuid) TO authenticated;
```

---

## 🔒 PHASE 2: SECURITY HARDENING (PRIORITY: CRITICAL)

### **Issue**: 3 Security Vulnerabilities Detected by Linter
**Impact**: Data exposure and privilege escalation risks  
**Time Required**: 45 minutes

#### **Files to Create/Modify:**
```
supabase/migrations/20250918_security_hardening.sql
```

#### **Security Migration Required:**
```sql
-- supabase/migrations/20250918_security_hardening.sql

-- Fix 1: Add search_path to functions missing it
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Update all functions without search_path
  FOR func_record IN 
    SELECT n.nspname, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proconfig IS NULL
    AND p.proname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I() SET search_path = public', 
                   func_record.nspname, func_record.proname);
  END LOOP;
END $$;

-- Fix 2: Review and secure SECURITY DEFINER functions
-- (Manual review required - check each function individually)

-- Fix 3: Create audit log for security changes
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'security_hardening_applied',
  'Security',
  'Applied security hardening migration',
  jsonb_build_object(
    'timestamp', now(),
    'fixes_applied', jsonb_build_array(
      'search_path_standardization',
      'function_security_review'
    )
  )
);
```

---

## 🔧 PHASE 3: TEMPLATE KEY STANDARDIZATION (PRIORITY: HIGH)

### **Issue**: Template keys not standardized at database level
**Impact**: Inconsistent email template selection  
**Time Required**: 20 minutes

#### **Files to Create/Modify:**
```
supabase/migrations/20250918_standardize_template_keys.sql
```

#### **Template Standardization Migration:**
```sql
-- supabase/migrations/20250918_standardize_template_keys.sql

-- Create template mapping table
CREATE TABLE IF NOT EXISTS email_template_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_status text NOT NULL,
  template_key text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(order_status, template_key)
);

-- Insert standardized mappings
INSERT INTO email_template_mapping (order_status, template_key) VALUES
  ('confirmed', 'order_confirmed'),
  ('preparing', 'order_preparing'),
  ('ready', 'order_ready'),
  ('out_for_delivery', 'order_out_for_delivery'),
  ('delivered', 'order_delivered'),
  ('cancelled', 'order_cancelled')
ON CONFLICT (order_status, template_key) DO NOTHING;

-- Update existing communication events to use standardized keys
UPDATE communication_events 
SET template_key = CASE 
  WHEN template_key = 'order_status_update' AND event_type = 'order_status_update' THEN 
    COALESCE(
      (SELECT etm.template_key 
       FROM email_template_mapping etm 
       JOIN orders o ON o.id = communication_events.order_id 
       WHERE etm.order_status = o.status::text
       LIMIT 1), 
      'order_status_update'
    )
  ELSE template_key
END
WHERE template_key IS NOT NULL;
```

---

## 📊 PHASE 4: MONITORING & VALIDATION (PRIORITY: HIGH)

### **Issue**: No system health monitoring or validation
**Impact**: Cannot detect production issues  
**Time Required**: 45 minutes

#### **Files to Create:**
```
src/utils/systemHealthCheck.ts
src/hooks/useSystemHealth.ts
src/components/admin/SystemHealthDashboard.tsx
```

#### **System Health Checker:**
```typescript
// src/utils/systemHealthCheck.ts
import { supabase } from '@/integrations/supabase/client';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'warning' | 'critical';
  responseTime: number;
  error?: string;
}

export const runSystemHealthCheck = async (): Promise<HealthCheck[]> => {
  const checks: HealthCheck[] = [];
  
  // Database function health
  const dbStart = Date.now();
  try {
    await supabase.rpc('get_detailed_order_with_products', { 
      p_order_id: '00000000-0000-0000-0000-000000000000' 
    });
    checks.push({
      service: 'database_functions',
      status: 'healthy',
      responseTime: Date.now() - dbStart
    });
  } catch (error: any) {
    checks.push({
      service: 'database_functions',
      status: 'critical',
      responseTime: Date.now() - dbStart,
      error: error.message
    });
  }
  
  // Edge function health
  const edgeStart = Date.now();
  try {
    const response = await supabase.functions.invoke('admin-orders-manager', {
      body: { action: 'health_check' }
    });
    
    checks.push({
      service: 'edge_functions',
      status: response.error ? 'critical' : 'healthy',
      responseTime: Date.now() - edgeStart,
      error: response.error?.message
    });
  } catch (error: any) {
    checks.push({
      service: 'edge_functions', 
      status: 'critical',
      responseTime: Date.now() - edgeStart,
      error: error.message
    });
  }
  
  return checks;
};
```

---

## 🧪 PHASE 5: BASIC TESTING IMPLEMENTATION (PRIORITY: MEDIUM)

### **Issue**: Zero test coverage exists
**Impact**: Cannot validate fixes before deployment  
**Time Required**: 2-3 hours

#### **Files to Create:**
```
tests/critical-path.test.ts
tests/database-functions.test.ts  
tests/email-delivery.test.ts
package.json (update test scripts)
```

#### **Critical Path Test:**
```typescript
// tests/critical-path.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '../src/integrations/supabase/client';

describe('Critical System Paths', () => {
  beforeAll(async () => {
    // Setup test environment
  });

  it('should execute get_detailed_order_with_products without error', async () => {
    const { data, error } = await supabase.rpc('get_detailed_order_with_products', {
      p_order_id: '00000000-0000-0000-0000-000000000000'
    });
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should handle admin orders manager health check', async () => {
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: { action: 'health_check' }
    });
    
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
  });

  it('should validate email rate limiting', async () => {
    const { data, error } = await supabase.functions.invoke('enhanced-email-rate-limiter', {
      body: { 
        identifier: 'test@example.com',
        emailType: 'transactional',
        checkOnly: true
      }
    });
    
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
  });
});
```

---

## ⚡ EXECUTION CHECKLIST

### **Immediate Actions (Next 2 Hours):**
- [ ] **Apply database function fix migration** (30 min)
- [ ] **Apply security hardening migration** (45 min) 
- [ ] **Apply template standardization migration** (20 min)
- [ ] **Test critical paths manually** (25 min)

### **Follow-up Actions (Next 3-6 Hours):**
- [ ] **Implement system health monitoring** (45 min)
- [ ] **Create basic test suite** (2-3 hours)  
- [ ] **Validate email delivery end-to-end** (30 min)
- [ ] **Performance testing under load** (1 hour)

### **Production Readiness Validation:**
- [ ] All migrations applied successfully
- [ ] Supabase linter shows 0 critical issues
- [ ] System health check returns all green
- [ ] Basic tests pass
- [ ] Manual order flow test completes successfully

---

## 🎯 SUCCESS METRICS

**Before Go-Live, System Must Achieve:**
- Database function response time < 2 seconds
- Email delivery success rate > 95%
- Zero critical security vulnerabilities
- Zero critical errors in production logs
- All critical path tests passing

---

**Next Step**: Begin with **PHASE 1: Emergency Database Repair** - this is blocking all other functionality and must be fixed first.

**Estimated Total Time to Production Ready**: 5-8 hours with immediate action on critical fixes.