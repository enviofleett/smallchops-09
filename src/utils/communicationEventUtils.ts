/**
 * Communication Event Utilities for Enhanced Duplicate Prevention
 * 
 * This utility provides robust methods for creating communication events
 * with comprehensive duplicate prevention and error handling.
 */

export interface CommunicationEventData {
  event_type: string;
  recipient_email: string;
  template_key?: string;
  template_variables?: Record<string, any>;
  order_id?: string;
  priority?: 'low' | 'normal' | 'high';
  channel?: 'email' | 'sms';
}

export interface DedupeKeyOptions {
  includeTimestamp?: boolean;
  includeUniqueId?: boolean;
  customSuffix?: string;
}

/**
 * Generates a robust dedupe key for communication events
 */
export function generateRobustDedupeKey(
  data: CommunicationEventData,
  options: DedupeKeyOptions = {}
): string {
  const {
    includeTimestamp = true,
    includeUniqueId = true,
    customSuffix
  } = options;

  const baseComponents = [
    data.order_id || 'no-order',
    data.event_type,
    data.template_key || 'no-template',
    data.recipient_email
  ];

  const uniqueComponents = [];
  
  if (includeTimestamp) {
    uniqueComponents.push(Date.now().toString());
  }
  
  if (includeUniqueId) {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 
      Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
    uniqueComponents.push(uuid);
  }
  
  if (customSuffix) {
    uniqueComponents.push(customSuffix);
  }

  const baseKey = baseComponents.join('|');
  const uniqueSuffix = uniqueComponents.join('_');
  
  return `${baseKey}|${uniqueSuffix}`;
}

/**
 * Validates communication event data before sending
 */
export function validateCommunicationEventData(data: CommunicationEventData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!data.event_type || data.event_type.trim() === '') {
    errors.push('Event type is required');
  }

  if (!data.recipient_email || data.recipient_email.trim() === '') {
    errors.push('Recipient email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.recipient_email)) {
    errors.push('Invalid email format');
  }

  // Template validation
  if (!data.template_key) {
    warnings.push('No template key specified - will use default');
  }

  // Order ID validation for order-related events
  if (data.event_type.includes('order') && !data.order_id) {
    warnings.push('Order-related event without order_id');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Creates a communication event with enhanced error handling
 */
export async function createCommunicationEventSafely(
  supabaseClient: any,
  data: CommunicationEventData,
  options: DedupeKeyOptions = {}
): Promise<{
  success: boolean;
  event_id?: string;
  error?: string;
  isDuplicate?: boolean;
}> {
  try {
    // Validate input data
    const validation = validateCommunicationEventData(data);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Communication event warnings:', validation.warnings);
    }

    // Generate robust dedupe key
    const dedupeKey = generateRobustDedupeKey(data, options);

    // Attempt to insert the event
    const { data: eventData, error } = await supabaseClient
      .from('communication_events')
      .insert({
        event_type: data.event_type,
        recipient_email: data.recipient_email,
        template_key: data.template_key,
        template_variables: data.template_variables || {},
        order_id: data.order_id,
        status: 'queued',
        dedupe_key: dedupeKey,
        priority: data.priority || 'normal',
        channel: data.channel || 'email'
      })
      .select('id')
      .single();

    if (error) {
      // Handle duplicate key errors gracefully
      if (error.code === '23505' && error.message.includes('communication_events_dedupe_key_unique')) {
        console.log('📨 Duplicate communication event prevented (expected behavior)');
        return {
          success: true,
          isDuplicate: true,
          error: 'Duplicate event prevented'
        };
      }
      
      // Handle other errors
      console.error('❌ Failed to create communication event:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }

    console.log('✅ Communication event created successfully:', eventData.id);
    return {
      success: true,
      event_id: eventData.id
    };

  } catch (exception: any) {
    console.error('❌ Exception in createCommunicationEventSafely:', exception);
    return {
      success: false,
      error: `Exception: ${exception.message}`
    };
  }
}

/**
 * Utility for tracking recent communication events to prevent client-side duplicates
 */
class CommunicationEventTracker {
  private recentEvents = new Map<string, number>();
  private readonly ttl = 300000; // 5 minutes

  /**
   * Check if an event was recently created
   */
  isRecentDuplicate(data: CommunicationEventData): boolean {
    const key = `${data.order_id}|${data.event_type}|${data.recipient_email}`;
    const now = Date.now();
    const lastSent = this.recentEvents.get(key);
    
    if (lastSent && (now - lastSent) < this.ttl) {
      return true;
    }

    // Clean up old entries
    this.cleanup();
    return false;
  }

  /**
   * Record that an event was created
   */
  recordEvent(data: CommunicationEventData): void {
    const key = `${data.order_id}|${data.event_type}|${data.recipient_email}`;
    this.recentEvents.set(key, Date.now());
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.recentEvents.entries()) {
      if (now - timestamp > this.ttl) {
        this.recentEvents.delete(key);
      }
    }
  }
}

export const communicationEventTracker = new CommunicationEventTracker();

/**
 * Enhanced wrapper for order status change communications
 */
export async function createOrderStatusChangeEvent(
  supabaseClient: any,
  orderData: {
    order_id: string;
    order_number: string;
    customer_email: string;
    customer_name?: string;
    old_status?: string;
    new_status: string;
  }
): Promise<{ success: boolean; isDuplicate?: boolean; error?: string }> {
  const eventData: CommunicationEventData = {
    event_type: 'order_status_update',
    recipient_email: orderData.customer_email,
    template_key: `order_status_${orderData.new_status}`,
    template_variables: {
      customer_name: orderData.customer_name || 'Customer',
      order_number: orderData.order_number,
      order_status: orderData.new_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      old_status: orderData.old_status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '',
      new_status: orderData.new_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      status_date: new Date().toLocaleDateString('en-NG'),
      business_name: 'Starters Small Chops'
    },
    order_id: orderData.order_id,
    priority: 'normal'
  };

  // Check for recent duplicates
  if (communicationEventTracker.isRecentDuplicate(eventData)) {
    console.log('⚠️ Recent duplicate detected by client-side tracker, skipping');
    return {
      success: true,
      isDuplicate: true
    };
  }

  // Create the event
  const result = await createCommunicationEventSafely(supabaseClient, eventData, {
    customSuffix: `status_change_${orderData.old_status}_to_${orderData.new_status}`
  });

  // Record successful creation
  if (result.success && !result.isDuplicate) {
    communicationEventTracker.recordEvent(eventData);
  }

  return result;
}