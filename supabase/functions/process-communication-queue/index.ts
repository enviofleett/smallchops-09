
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from './constants/config.ts';
import { SettingsService } from './services/SettingsService.ts';
import { EventQueueService } from './services/EventQueueService.ts';
import { CommunicationProcessor } from './services/CommunicationProcessor.ts';

console.log('process-communication-queue function booting up v6 (refactored)');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    console.log('process-communication-queue function invoked');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const settingsService = new SettingsService(supabaseAdmin);
    const settings = await settingsService.getSettings();

    if (!settings) {
      console.log('Communication settings not found. Aborting.');
      return new Response(JSON.stringify({ message: 'Communication settings not configured.' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const eventQueueService = new EventQueueService(supabaseAdmin);
    const events = await eventQueueService.fetchQueuedEvents();

    if (!events || events.length === 0) {
      console.log('No queued communication events to process.');
      return new Response(JSON.stringify({ message: 'No events to process' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Found ${events.length} events to process.`);
    const processor = new CommunicationProcessor(supabaseAdmin, settings);

    // Process events concurrently
    await Promise.all(events.map(event => processor.processEvent(event)));

    return new Response(JSON.stringify({ message: `Processed ${events.length} events.` }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Critical error in process-communication-queue function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
