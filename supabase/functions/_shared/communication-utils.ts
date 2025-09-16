/**
 * Production-Ready Communication Utilities
 * Handles robust communication event creation and management
 */

import { generateCommunicationDedupeKey, validateDedupeKey } from './dedupe-key-generator.ts';

export interface CommunicationEventData {
  event_type: string;
  recipient_email: string;
  template_key?: string;
  template_variables?: Record<string, any>;
  order_id?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  channel?: 'email' | 'sms';
}

export interface CreateEventResult {
  success: boolean;
  event_id?: string;
  error?: string;
  isDuplicate?: boolean;
  attempts?: number;
}

/**
 * Safely creates a communication event with comprehensive error handling
 */
export async function createCommunicationEventSafe(
  supabaseClient: any,
  eventData: CommunicationEventData,
  maxAttempts: number = 5
): Promise<CreateEventResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      // Generate unique dedupe key for this attempt
      const dedupeKey = generateCommunicationDedupeKey(
        eventData.order_id || null,
        eventData.event_type,
        eventData.template_key || null,
        eventData.recipient_email,
        { customSuffix: `attempt${attempts}` }
      );

      // Validate dedupe key
      const validation = validateDedupeKey(dedupeKey);
      if (!validation.isValid) {
        console.error('Invalid dedupe key:', validation.reason);
        continue;
      }

      // Attempt to insert communication event
      const { data, error } = await supabaseClient
        .from('communication_events')
        .insert({
          event_type: eventData.event_type,
          recipient_email: eventData.recipient_email,
          template_key: eventData.template_key,
          template_variables: eventData.template_variables || {},
          order_id: eventData.order_id,
          priority: eventData.priority || 'normal',
          channel: eventData.channel || 'email',
          status: 'queued',
          dedupe_key: dedupeKey,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          // Duplicate key violation - try with new dedupe key
          console.log(`Attempt ${attempts}: Dedupe collision, retrying...`);
          continue;
        } else {
          // Other database error
          console.error(`Communication event creation failed:`, error);
          return {
            success: false,
            error: error.message,
            attempts
          };
        }
      }

      // Success
      console.log(`✅ Communication event created successfully on attempt ${attempts}`);
      return {
        success: true,
        event_id: data.id,
        attempts
      };

    } catch (error: any) {
      console.error(`Attempt ${attempts} failed:`, error);
      
      if (attempts >= maxAttempts) {
        return {
          success: false,
          error: error.message,
          attempts
        };
      }
      
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
    }
  }

  return {
    success: false,
    error: 'Max attempts exceeded',
    attempts
  };
}

/**
 * Checks for existing communication events to prevent duplicates
 */
export async function checkExistingCommunicationEvent(
  supabaseClient: any,
  orderId: string,
  eventType: string,
  templateKey: string,
  recipientEmail: string
): Promise<{ exists: boolean; event?: any }> {
  try {
    const { data, error } = await supabaseClient
      .from('communication_events')
      .select('id, status, created_at')
      .eq('order_id', orderId)
      .eq('event_type', eventType)
      .eq('template_key', templateKey)
      .eq('recipient_email', recipientEmail)
      .in('status', ['queued', 'processing', 'sent'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error checking existing events:', error);
      return { exists: false };
    }

    return {
      exists: data && data.length > 0,
      event: data?.[0]
    };
  } catch (error) {
    console.error('Exception checking existing events:', error);
    return { exists: false };
  }
}

/**
 * Creates or updates communication event with fallback mechanisms
 */
export async function upsertCommunicationEventSafe(
  supabaseClient: any,
  eventData: CommunicationEventData
): Promise<CreateEventResult> {
  try {
    // First check if similar event already exists
    if (eventData.order_id && eventData.template_key) {
      const existing = await checkExistingCommunicationEvent(
        supabaseClient,
        eventData.order_id,
        eventData.event_type,
        eventData.template_key,
        eventData.recipient_email
      );

      if (existing.exists) {
        console.log('Similar communication event already exists, skipping duplicate');
        return {
          success: true,
          isDuplicate: true,
          event_id: existing.event?.id
        };
      }
    }

    // Create new event
    return await createCommunicationEventSafe(supabaseClient, eventData);

  } catch (error: any) {
    console.error('Upsert communication event failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cleanup failed or stuck communication events
 */
export async function cleanupStuckEvents(supabaseClient: any): Promise<number> {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data, error } = await supabaseClient
      .from('communication_events')
      .update({ 
        status: 'failed',
        error_message: 'Event stuck in processing state, marked as failed',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('processing_started_at', thirtyMinutesAgo)
      .select('id');

    if (error) {
      console.error('Error cleaning up stuck events:', error);
      return 0;
    }

    console.log(`🧹 Cleaned up ${data?.length || 0} stuck communication events`);
    return data?.length || 0;
  } catch (error) {
    console.error('Exception during cleanup:', error);
    return 0;
  }
}
