
import { SupabaseAdminClient, CommunicationEvent } from '../utils/types.ts';
import { MAX_RETRIES } from '../constants/config.ts';

export class EventQueueService {
  constructor(private supabaseAdmin: SupabaseAdminClient) {}

  async fetchQueuedEvents(limit = 10): Promise<CommunicationEvent[]> {
    const { data: events, error: fetchError } = await this.supabaseAdmin
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    return events || [];
  }

  async markAsProcessing(eventId: string): Promise<void> {
    await this.supabaseAdmin
      .from('communication_events')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', eventId);
  }

  async markAsSent(eventId: string, reason?: string): Promise<void> {
    await this.supabaseAdmin
      .from('communication_events')
      .update({ status: 'sent', processed_at: new Date().toISOString(), last_error: reason })
      .eq('id', eventId);
  }

  async handleProcessingError(event: CommunicationEvent, error: Error): Promise<void> {
    const newRetryCount = event.retry_count + 1;
    const isFailed = newRetryCount >= MAX_RETRIES;
    await this.supabaseAdmin
      .from('communication_events')
      .update({ 
        status: isFailed ? 'failed' : 'queued', 
        last_error: error.message, 
        retry_count: newRetryCount,
        processed_at: isFailed ? new Date().toISOString() : null,
      })
      .eq('id', event.id);
  }
}
