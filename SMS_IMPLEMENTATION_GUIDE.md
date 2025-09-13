# SMS Communication Implementation Guide

## Overview

This document describes the SMS communication channel implementation for the Starters Small Chops platform, integrating SMS alongside email notifications using the mysmstab.com API.

## Features

- **SMS Notifications**: Send SMS for order status updates, payment confirmations, and customer communications
- **Admin Dashboard**: Complete SMS management interface with usage analytics and balance monitoring  
- **Template Management**: Create and manage SMS message templates with variable substitution
- **Suppression List**: Manage opt-out requests and blocked phone numbers
- **Delivery Tracking**: Monitor SMS delivery status, costs, and failures
- **Testing Tools**: Test SMS functionality and troubleshoot delivery issues

## Architecture

### Database Schema

#### Extended `communication_events` Table
- `recipient_phone` - Phone number for SMS delivery
- `sms_status` - SMS-specific delivery status
- `sms_provider_message_id` - Provider's message tracking ID
- `sms_provider_response` - Full provider API response
- `channel` - Communication channel ('email', 'sms', 'both')
- `sms_sent_at` - SMS delivery timestamp
- `sms_delivery_status` - Final delivery status
- `sms_error_message` - Error details for failed deliveries

#### New SMS Tables
- `sms_suppression_list` - Opt-out and blocked phone numbers
- `sms_delivery_logs` - Detailed SMS delivery tracking
- `sms_provider_settings` - Provider configuration and settings

### Functions

#### SMS Sender Function (`sms-sender/index.ts`)
- Processes queued SMS events from `communication_events` table
- Integrates with mysmstab.com API for SMS delivery
- Handles rate limiting, retries, and error management
- Updates delivery status and logs results
- Supports balance checking and connection testing

#### Business Settings Function Updates
- `check_sms_credentials` - Verify SMS API credentials in Function Secrets
- `check_sms_balance` - Check SMS provider wallet balance

### Admin UI Components

#### SMS Dashboard (`SMSDashboard.tsx`)
- Usage metrics and success rates
- Wallet balance monitoring with alerts
- Recent activity and delivery status
- Real-time statistics

#### SMS Settings (`SMSCredentialsManager.tsx`) 
- Provider configuration (mysmstab.com)
- Sender ID and API endpoint settings
- Function Secrets setup instructions
- Connection testing

#### SMS Suppression Manager (`SMSSuppressionManager.tsx`)
- Add/remove phone numbers from suppression list
- Reason categorization (opt-out, bounced, invalid, admin blocked)
- Search and filter functionality

#### SMS Logs Viewer (`SMSLogsViewer.tsx`)
- Delivery log viewing with filters
- Retry failed messages
- Export logs to CSV
- Detailed delivery information

#### SMS Template Manager (`SMSTemplateManager.tsx`)
- Create and edit SMS templates
- Variable substitution preview
- Character count validation (160 char limit)
- Event type mapping

#### SMS Tester (`SMSTester.tsx`)
- Connection testing
- Send test SMS messages
- Template testing with sample data
- Troubleshooting guidelines

## Setup and Configuration

### 1. Database Migration

Apply the database migrations to extend the schema:

```sql
-- Run the SMS communication support migration
-- File: 20250913103300_add_sms_communication_support.sql

-- Run the trigger updates migration  
-- File: 20250913103400_update_triggers_for_sms.sql
```

### 2. Function Secrets Configuration

Configure the following secrets in Supabase Function Secrets:

```bash
# Required secrets
MYSMSTAB_API_KEY=your_api_key_here
MYSMSTAB_SENDER_ID=your_sender_id_here

# Optional secrets
MYSMSTAB_API_ENDPOINT=https://api.mysmstab.com/v1/sms/send
```

### 3. Provider Account Setup

1. Create an account at [mysmstab.com](https://mysmstab.com)
2. Obtain API credentials
3. Register a sender ID
4. Fund your account wallet
5. Configure webhook endpoints (optional)

### 4. Admin UI Access

The SMS Communication section is available in the admin panel at `/admin/sms` with the following tabs:

- **Dashboard** - Usage overview and metrics
- **Templates** - Message template management  
- **Logs** - Delivery tracking and monitoring
- **Settings** - Provider configuration
- **Suppression** - Opt-out list management
- **Testing** - SMS testing tools

## API Integration

### MySmstab.com API

The implementation uses the mysmstab.com REST API for SMS delivery:

```typescript
// API endpoint
POST https://api.mysmstab.com/v1/sms/send

// Headers
Authorization: Bearer {API_KEY}
Content-Type: application/json

// Request body
{
  "to": "+234xxxxxxxxxx",
  "message": "Your SMS message content",
  "sender": "YourSenderID",
  "type": "sms"
}

// Response
{
  "status": "success",
  "message": "SMS sent successfully",
  "data": {
    "message_id": "msg_xxxxxxxx",
    "cost": 4.50,
    "phone_number": "+234xxxxxxxxxx",
    "status": "sent"
  }
}
```

## Event Types

### SMS Event Types
- `order_status_sms` - Order status updates
- `payment_confirmation_sms` - Payment confirmations
- `welcome_sms` - Welcome messages
- `order_ready_sms` - Order ready notifications
- `order_completed_sms` - Order completion
- `order_cancelled_sms` - Order cancellation
- `delivery_scheduled_sms` - Delivery scheduling

### Template Variables

Common variables available in SMS templates:

- `{{customerName}}` - Customer's name
- `{{orderNumber}}` - Order reference number
- `{{orderStatus}}` - Current order status
- `{{orderTotal}}` - Order total amount
- `{{trackingUrl}}` - Order tracking link
- `{{companyName}}` - Business name
- `{{shopUrl}}` - Website URL

## Triggering SMS Events

### Automatic Triggers

SMS events are automatically queued when:

1. **Order Status Changes** - Triggers `order_status_sms` 
2. **Payment Confirmation** - Triggers `payment_confirmation_sms`
3. **Customer Registration** - Triggers `welcome_sms`

### Manual Triggers

Use the helper functions to queue SMS events programmatically:

```sql
-- Queue SMS communication event
SELECT queue_sms_communication_event(
  order_id := 'order-uuid-here',
  event_type := 'order_ready_sms', 
  recipient_phone := '+234xxxxxxxxxx',
  payload := '{"customerName": "John Doe", "orderNumber": "ORD-001"}'
);

-- Queue payment confirmation SMS
SELECT upsert_payment_confirmation_sms_event(
  order_id := 'order-uuid-here',
  customer_phone := '+234xxxxxxxxxx'
);
```

## Security and Compliance

### Data Protection
- All SMS credentials stored securely in Function Secrets
- Phone numbers encrypted in transit
- Audit logging for all SMS operations
- RLS policies for data access control

### Opt-out Compliance
- Automatic suppression list enforcement
- Multiple opt-out reasons (user request, bounced, invalid)
- Admin tools for managing suppressions
- Compliance with SMS marketing regulations

### Rate Limiting
- Configurable rate limits (default: 60 SMS/minute)
- Exponential backoff for retries
- Provider-specific throttling
- Queue-based processing to prevent overload

## Monitoring and Troubleshooting

### Health Checks
- Provider connection testing
- API credential validation
- Balance monitoring with alerts
- Delivery rate tracking

### Common Issues

1. **SMS Not Sending**
   - Check Function Secrets configuration
   - Verify provider account balance
   - Confirm phone number format
   - Check suppression list

2. **High Delivery Failures**
   - Review phone number validation
   - Check provider status
   - Verify message content compliance
   - Monitor rate limiting

3. **Balance Alerts**
   - Set up low balance notifications
   - Automate balance monitoring
   - Configure alert thresholds

### Logging and Debugging

- All SMS operations logged in `sms_delivery_logs`
- Failed deliveries tracked with error details
- Provider responses stored for debugging
- Admin audit trail for all SMS actions

## Cost Management

### SMS Pricing
- Costs tracked per message
- Provider-specific pricing tiers
- Balance monitoring and alerts
- Usage analytics and reporting

### Budget Controls
- Low balance warnings
- Daily/monthly usage limits (configurable)
- Cost reporting and analytics
- Provider account management

## Testing

### Testing Tools Available
1. **Connection Test** - Verify API connectivity
2. **Message Test** - Send test SMS to your phone
3. **Template Test** - Test variable substitution
4. **Balance Check** - Verify account balance

### Testing Best Practices
- Always test with your own phone number
- Verify message formatting and length
- Test all event types and templates
- Monitor costs during testing
- Use staging credentials when available

## Maintenance

### Regular Tasks
- Monitor delivery success rates
- Review suppression list
- Check provider account balance
- Update templates as needed
- Review cost analytics

### Backup and Recovery
- SMS templates backed up with business settings
- Delivery logs retained according to data policy
- Suppression list exported regularly
- Configuration documented in version control

## Support

For issues with the SMS implementation:

1. Check the admin testing tools
2. Review delivery logs for errors
3. Verify Function Secrets configuration
4. Contact mysmstab.com support for provider issues
5. Review audit logs for system events

## Changelog

### v1.0.0 - Initial Implementation
- Core SMS sending functionality
- mysmstab.com API integration  
- Admin dashboard and management tools
- Suppression list management
- Template system with variables
- Delivery tracking and logging
- Testing and troubleshooting tools