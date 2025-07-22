
import { SupabaseAdminClient, CustomerCommunicationPreference } from '../utils/types.ts';

export class CustomerPreferencesService {
  constructor(private supabaseAdmin: SupabaseAdminClient) {}

  async getOrCreatePreferences(customerEmail: string): Promise<CustomerCommunicationPreference | null> {
    if (!customerEmail) return null;

    const { data: prefData, error: prefError } = await this.supabaseAdmin
      .from('customer_communication_preferences')
      .select('*')
      .eq('customer_email', customerEmail)
      .single();

    if (prefError && prefError.code !== 'PGRST116') { // PGRST116: "exact one row not found"
      console.error(`Error fetching preferences for ${customerEmail}:`, prefError);
      return null;
    }
    
    if (prefData) {
      console.log(`Found communication preferences for ${customerEmail}.`);
      return prefData;
    }
    
    const { data: newPref, error: newPrefError } = await this.supabaseAdmin
      .from('customer_communication_preferences')
      .insert({ customer_email: customerEmail }) // Defaults are handled by the DB
      .select()
      .single();

    if (newPrefError) {
      console.error(`Error creating default preferences for ${customerEmail}:`, newPrefError);
      return null;
    }
    
    console.log(`Created default communication preferences for ${customerEmail}.`);
    return newPref;
  }
}
