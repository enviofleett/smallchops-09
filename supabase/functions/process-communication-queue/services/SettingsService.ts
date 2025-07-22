
import { SupabaseAdminClient, CommunicationSettings } from '../utils/types.ts';

export class SettingsService {
  constructor(private supabaseAdmin: SupabaseAdminClient) {}

  async getSettings(): Promise<CommunicationSettings | null> {
    const { data: settings, error: settingsError } = await this.supabaseAdmin
      .from('communication_settings')
      .select('*')
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching communication settings:', settingsError);
      throw new Error('Could not fetch communication settings.');
    }

    return settings;
  }
}
