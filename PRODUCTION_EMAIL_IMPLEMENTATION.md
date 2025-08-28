# Production-Ready Email Implementation Plan

## 🚀 Unified Email Service Architecture

### Core Service Structure
```typescript
// supabase/functions/email-core/index.ts
interface EmailRequest {
  to: string | string[];
  template_key?: string;
  subject?: string;
  html_content?: string;
  text_content?: string;
  variables?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  email_type?: 'transactional' | 'marketing';
  send_at?: string; // Schedule for later
}

interface EmailResponse {
  success: boolean;
  message_id?: string;
  error?: string;
  queued?: boolean;
}
```

### Recommended Database Schema
```sql
-- Core email queue (enhanced)
ALTER TABLE communication_events ADD COLUMN IF NOT EXISTS
  delivery_attempts INTEGER DEFAULT 0,
  last_delivery_attempt TIMESTAMP WITH TIME ZONE,
  bounce_type VARCHAR(20), -- 'hard', 'soft', 'complaint'
  provider_message_id VARCHAR(255),
  delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE;

-- Email suppression (consolidated)
CREATE TABLE IF NOT EXISTS email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL UNIQUE,
  suppression_type VARCHAR(20) NOT NULL, -- 'bounce', 'complaint', 'unsubscribe'
  reason TEXT,
  suppressed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'
);

-- Email analytics (new)
CREATE TABLE IF NOT EXISTS email_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  provider VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, provider)
);
```

## 🔧 Implementation Steps

### Step 1: Create Core Email Service
```typescript
// supabase/functions/email-core/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();
    
    switch (action) {
      case 'send':
        return await handleSendEmail(payload);
      case 'process_queue':
        return await processEmailQueue();
      case 'health_check':
        return await performHealthCheck();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

### Step 2: SMTP Configuration Management
```typescript
// utils/smtp-config.ts
interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  sender_email: string;
  sender_name: string;
}

async function getActiveSMTPConfig(supabase: any): Promise<SMTPConfig> {
  const { data, error } = await supabase
    .from('communication_settings')
    .select('*')
    .eq('use_smtp', true)
    .single();
    
  if (error || !data) {
    throw new Error('No active SMTP configuration found');
  }
  
  return {
    host: data.smtp_host,
    port: data.smtp_port || 587,
    secure: data.smtp_secure !== false,
    username: data.smtp_user,
    password: data.smtp_pass,
    sender_email: data.sender_email,
    sender_name: data.sender_name || 'Starters Small Chops'
  };
}
```

### Step 3: Template Processing
```typescript
// utils/template-processor.ts
async function processTemplate(
  supabase: any,
  templateKey: string,
  variables: Record<string, any>
): Promise<{subject: string, html: string, text: string}> {
  
  // Try to get template from database
  const { data: template } = await supabase
    .from('enhanced_email_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single();
    
  if (!template) {
    // Use fallback template
    return getFallbackTemplate(templateKey, variables);
  }
  
  // Process variables
  const processText = (text: string) => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  };
  
  return {
    subject: processText(template.subject_template),
    html: processText(template.html_template),
    text: processText(template.text_template || '')
  };
}
```

### Step 4: Rate Limiting & Bounce Handling
```typescript
// utils/rate-limiter.ts
const RATE_LIMITS = {
  per_hour: 100,
  per_day: 1000,
  burst: 10
};

async function checkRateLimit(email: string): Promise<{allowed: boolean, retryAfter?: number}> {
  // Check recent sends to this email
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const { count } = await supabase
    .from('communication_events')
    .select('*', { count: 'exact' })
    .eq('recipient_email', email)
    .gte('created_at', hourAgo.toISOString());
    
  if (count >= RATE_LIMITS.per_hour) {
    return { allowed: false, retryAfter: 3600 };
  }
  
  return { allowed: true };
}

// utils/bounce-handler.ts
async function handleBounce(email: string, bounceType: 'hard' | 'soft', reason: string) {
  // Add to suppression list for hard bounces
  if (bounceType === 'hard') {
    await supabase
      .from('email_suppressions')
      .upsert({
        email_address: email,
        suppression_type: 'bounce',
        reason: reason
      });
  }
  
  // Update analytics
  await updateEmailAnalytics('bounced');
}
```

## 📊 Monitoring & Health Checks

### Health Check Endpoint
```typescript
// supabase/functions/email-monitor/index.ts
async function performHealthCheck() {
  const checks = {
    smtp_connection: await testSMTPConnection(),
    database_connection: await testDatabaseConnection(),
    queue_size: await getQueueSize(),
    recent_failures: await getRecentFailures(),
    rate_limit_status: await getRateLimitStatus()
  };
  
  const overallHealth = Object.values(checks).every(check => check.status === 'healthy');
  
  return {
    status: overallHealth ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  };
}
```

### Email Analytics Dashboard
```typescript
// src/components/admin/EmailAnalyticsDashboard.tsx
export const EmailAnalyticsDashboard = () => {
  const { data: analytics } = useQuery({
    queryKey: ['email-analytics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_analytics')
        .select('*')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('date', { ascending: false });
      return data;
    }
  });
  
  return (
    <div className="space-y-6">
      <EmailMetricsCards analytics={analytics} />
      <EmailTrendsChart analytics={analytics} />
      <EmailHealthStatus />
    </div>
  );
};
```

## 🔒 Security Hardening

### RLS Policies
```sql
-- Secure communication_events
CREATE POLICY "Admins can manage communication events"
ON communication_events FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Secure email templates
CREATE POLICY "Admins can manage email templates"
ON enhanced_email_templates FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Public can view active templates for sending
CREATE POLICY "Service can read active templates"
ON enhanced_email_templates FOR SELECT
TO service_role
USING (is_active = true);
```

### Function Security
```sql
-- Fix all functions to include security settings
CREATE OR REPLACE FUNCTION send_email_securely(...)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate caller has permissions
  IF NOT is_admin() AND auth.role() != 'service_role' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  -- Email sending logic here
END;
$$;
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
// tests/email-core.test.ts
describe('Email Core Service', () => {
  test('should process template with variables', async () => {
    const result = await processTemplate('welcome', {
      customer_name: 'John Doe',
      store_name: 'Test Store'
    });
    
    expect(result.subject).toContain('John Doe');
    expect(result.html).toContain('Test Store');
  });
  
  test('should respect rate limits', async () => {
    const result = await checkRateLimit('test@example.com');
    expect(result.allowed).toBeDefined();
  });
});
```

### Integration Tests
```typescript
// tests/email-integration.test.ts
describe('Email Integration', () => {
  test('should send email end-to-end', async () => {
    const response = await fetch('/functions/v1/email-core', {
      method: 'POST',
      body: JSON.stringify({
        action: 'send',
        to: 'test@example.com',
        template_key: 'welcome',
        variables: { customer_name: 'Test User' }
      })
    });
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.message_id).toBeDefined();
  });
});
```

## 📋 Migration Plan

### Phase 1: Foundation (Week 1)
1. Create `email-core` function
2. Implement basic SMTP sending
3. Add template processing
4. Set up database schema updates

### Phase 2: Features (Week 2)
1. Add rate limiting
2. Implement bounce handling
3. Create monitoring endpoints
4. Set up analytics tracking

### Phase 3: Migration (Week 3)
1. Update frontend to use new service
2. Migrate existing email functions
3. Remove redundant code
4. Update documentation

### Phase 4: Testing & Launch (Week 4)
1. Comprehensive testing
2. Performance optimization
3. Security audit
4. Production deployment

## 🚀 Deployment Checklist

- [ ] Core email service implemented
- [ ] Database schema updated
- [ ] Security policies in place
- [ ] Rate limiting configured
- [ ] Monitoring system active
- [ ] Analytics dashboard ready
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Backup & recovery plan
- [ ] Performance benchmarks met

This implementation will provide a robust, scalable, and secure email system ready for production use.