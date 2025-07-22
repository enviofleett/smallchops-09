
import { SupabaseAdminClient, CommunicationLogData } from '../utils/types.ts';

export class CommunicationLogger {
  constructor(private supabaseAdmin: SupabaseAdminClient) {}

  async log(logData: CommunicationLogData) {
    const { error } = await this.supabaseAdmin.from('communication_logs').insert(logData);
    if (error) {
      console.error('Failed to write to communication_logs:', error);
      // Non-critical, so we don't throw. The main process should continue.
    }
  }
}
