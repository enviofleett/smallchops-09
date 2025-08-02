import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('=== Instant Email Processor Started ===')

    // Get all queued communication events that need immediate processing
    const { data: queuedEvents, error: fetchError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('Error fetching queued events:', fetchError)
      throw fetchError
    }

    if (!queuedEvents || queuedEvents.length === 0) {
      console.log('✅ No queued events found')
      return new Response(
        JSON.stringify({ 
          message: 'No queued events to process', 
          processed: 0,
          status: 'success'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📧 Found ${queuedEvents.length} queued events to process immediately`)

    // Process each event by calling the enhanced processor
    let successCount = 0
    let failureCount = 0

    for (const event of queuedEvents) {
      try {
        console.log(`🔄 Processing event ${event.id}: ${event.event_type}`)
        
        // Call the enhanced processor for each event individually
        const { data, error } = await supabase.functions.invoke('process-communication-events-enhanced', {
          body: {
            immediate_processing: true,
            event_id: event.id
          }
        })

        if (error) {
          console.error(`❌ Failed to process event ${event.id}:`, error)
          failureCount++
        } else {
          console.log(`✅ Successfully processed event ${event.id}`)
          successCount++
        }

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError)
        failureCount++
      }
    }

    console.log(`=== Processing Complete ===`)
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${failureCount}`)

    return new Response(
      JSON.stringify({ 
        message: 'Email processing completed',
        total_events: queuedEvents.length,
        successful: successCount,
        failed: failureCount,
        status: 'completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('=== Instant Email Processor Error ===')
    console.error('Error:', error.message)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: 'error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})