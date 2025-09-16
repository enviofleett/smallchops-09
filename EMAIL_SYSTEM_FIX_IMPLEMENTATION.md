# Email System Fix Implementation Plan

Based on the audit findings, here's the step-by-step implementation to fix the email system template usage:

## 🔴 CRITICAL FIX 1: Reverse Template Lookup Priority

### Problem
`unified-smtp-sender` checks `email_templates` view first, then falls back to `enhanced_email_templates`. This means templates created in the Email Template Manager may not be used.

### Solution
```typescript
// CURRENT PROBLEMATIC ORDER (lines 305-335)
// 1. Check email_templates view (❌ PRIMARY)
// 2. Check enhanced_email_templates (✅ SHOULD BE PRIMARY)

// FIXED ORDER 
// 1. Check enhanced_email_templates (✅ PRIMARY - from settings)
// 2. Check email_templates view (fallback only)
```

### Implementation
Update `supabase/functions/unified-smtp-sender/index.ts` lines 302-340:

```typescript
if (templateKey) {
  try {
    // PRIMARY: Check enhanced_email_templates (from Email Template Manager)
    const { data: enhancedTemplate } = await supabase
      .from('enhanced_email_templates')
      .select('*')
      .eq('template_key', templateKey)
      .eq('is_active', true)
      .maybeSingle();

    if (enhancedTemplate) {
      template = {
        subject: enhancedTemplate.subject_template,
        html_content: enhancedTemplate.html_template,
        text_content: enhancedTemplate.text_template,
        template_type: enhancedTemplate.template_type || 'standard'
      };
      templateType = template.template_type;
      templateFound = true;
    } else {
      // FALLBACK: Check email_templates view (legacy)
      const { data: viewTemplate } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('is_active', true)
        .maybeSingle();

      if (viewTemplate) {
        template = viewTemplate;
        templateType = viewTemplate.template_type || 'standard';
        templateFound = true;
      }
    }
  } catch (error) {
    console.warn(`Template lookup failed for ${templateKey}:`, error.message);
  }
}
```

## 🔴 CRITICAL FIX 2: Add Template Key Validation

### Problem
Many email events are queued without template_key, causing 41 failures in the last 7 days.

### Solution
Add template_key validation in all functions that queue emails.

### Implementation
Create validation function in `unified-smtp-sender`:

```typescript
// Add after line 460
async function validateTemplateKey(templateKey: string): Promise<boolean> {
  if (!templateKey) return false;
  
  const { data } = await supabase
    .from('enhanced_email_templates')
    .select('id')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .maybeSingle();
    
  return !!data;
}

// Add validation before processing emails (around line 342)
if (isProductionMode && templateKey) {
  const isValidTemplate = await validateTemplateKey(templateKey);
  if (!isValidTemplate) {
    throw new Error(`PRODUCTION_MODE: Template '${templateKey}' not found in enhanced_email_templates`);
  }
}
```

## 🔴 CRITICAL FIX 3: Fix Edge Functions Template Key Assignment

### Problem
Functions like `process-communication-events` create email events without template_key.

### Solution
Update all edge functions to include proper template_key mapping.

### Key Functions to Update:

1. **process-communication-events/index.ts** - Lines 185-420
2. **customer-welcome-processor/index.ts** - Line 53
3. **payment-confirmation-processor** - Missing proper template assignment

### Template Key Mapping Standards:
```typescript
const TEMPLATE_KEY_MAPPING = {
  'order_status_update': {
    'confirmed': 'order_confirmed',
    'preparing': 'order_preparing', 
    'ready': 'order_ready',
    'out_for_delivery': 'out_for_delivery',
    'delivered': 'order_delivered',
    'completed': 'order_completed'
  },
  'customer_welcome': 'customer_welcome',
  'payment_confirmation': 'payment_confirmation',
  'order_confirmation': 'order_confirmation',
  'admin_notification': 'admin_new_order'
};
```

## 🟡 HIGH PRIORITY FIX: Clear Failed Email Queue

### Problem
41 failed `order_status_update` events with missing template_key are clogging the queue.

### Solution
```sql
-- Update failed events with proper template_key based on payload
UPDATE communication_events 
SET template_key = 'order_confirmed',
    status = 'queued',
    retry_count = 0,
    error_message = NULL
WHERE event_type = 'order_status_update' 
  AND status = 'failed'
  AND template_key IS NULL
  AND payload->>'status' = 'confirmed';

-- Similar updates for other statuses...
```

## 🟡 MEDIUM PRIORITY: Enhanced Template Management

### Add Template Validation to Email Template Manager
Update `src/components/settings/EmailTemplateManager.tsx`:

```typescript
// Add validation before saving templates
const validateTemplate = async (template: EmailTemplate) => {
  const requiredVariables = extractVariables(template.html_template);
  const missingVariables = requiredVariables.filter(v => 
    !template.variables.includes(v)
  );
  
  if (missingVariables.length > 0) {
    throw new Error(`Missing variables: ${missingVariables.join(', ')}`);
  }
};
```

### Add Template Usage Analytics
Create component to show which templates are actively used:

```typescript
// New component: TemplateUsageAnalytics.tsx
const TemplateUsageAnalytics = () => {
  // Query communication_events for template usage stats
  // Show which templates are used most/least
  // Identify unused templates
};
```

## Implementation Timeline

### Week 1 (CRITICAL)
- [ ] **Day 1**: Fix template lookup priority in unified-smtp-sender
- [ ] **Day 2**: Add template_key validation to unified-smtp-sender  
- [ ] **Day 3**: Update process-communication-events template mapping
- [ ] **Day 4**: Clear failed email queue with proper template_key
- [ ] **Day 5**: Test and validate all critical fixes

### Week 2 (HIGH PRIORITY)
- [ ] **Day 1-2**: Update remaining edge functions with template_key
- [ ] **Day 3-4**: Add template validation to Email Template Manager
- [ ] **Day 5**: Implement template usage monitoring

### Week 3 (MEDIUM PRIORITY)  
- [ ] **Day 1-3**: Create template usage analytics dashboard
- [ ] **Day 4-5**: Add template testing functionality

## Testing Plan

### Template Resolution Testing
```typescript
// Test script to verify template lookup works correctly
const testTemplateResolution = async () => {
  const testTemplates = ['customer_welcome', 'order_confirmed', 'payment_confirmation'];
  
  for (const templateKey of testTemplates) {
    const result = await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        to: 'test@example.com',
        templateKey,
        variables: { customer_name: 'Test User' },
        healthcheck: true
      }
    });
    
    console.log(`Template ${templateKey}:`, result.data?.templateFound ? '✅' : '❌');
  }
};
```

### Email Queue Testing
```typescript
// Test email queuing with template validation
const testEmailQueuing = async () => {
  const { data, error } = await supabase
    .from('communication_events')
    .insert({
      event_type: 'test_email',
      template_key: 'customer_welcome',
      recipient_email: 'test@example.com',
      variables: { customer_name: 'Test User' }
    });
    
  console.log('Queue test:', error ? '❌' : '✅');
};
```

## Success Metrics

### After Implementation
- **Zero failed emails** due to missing template_key
- **100% template resolution** for emails created via settings
- **Consistent template usage** across all email types
- **Production mode compliance** with no template bypasses

### Monitoring Points
- Template resolution success rate
- Email queue processing time
- Template usage distribution
- Failed email reduction

## Rollback Plan

If issues occur during implementation:

1. **Template Lookup**: Revert to original dual-lookup order
2. **Validation**: Disable production mode temporarily  
3. **Queue Clearing**: Restore failed events from backup
4. **Edge Functions**: Revert template_key changes

Keep backups of all modified functions and database states before implementation.