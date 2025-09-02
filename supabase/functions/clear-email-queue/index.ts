import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, statuses } = await req.json()

    console.log(`🧹 Email queue clear request - Action: ${action}, Statuses: ${JSON.stringify(statuses)}`)

    if (action === 'clear_queue') {
      let clearedCount = 0

      // Clear queued emails
      if (statuses.includes('queued')) {
        const { count: queuedCount, error: queuedError } = await supabase
          .from('communication_events')
          .delete()
          .eq('status', 'queued')

        if (queuedError) {
          console.error('❌ Failed to clear queued emails:', queuedError)
          throw queuedError
        }

        clearedCount += queuedCount || 0
        console.log(`✅ Cleared ${queuedCount || 0} queued emails`)
      }

      // Clear failed emails
      if (statuses.includes('failed')) {
        const { count: failedCount, error: failedError } = await supabase
          .from('communication_events')
          .delete()
          .eq('status', 'failed')

        if (failedError) {
          console.error('❌ Failed to clear failed emails:', failedError)
          throw failedError
        }

        clearedCount += failedCount || 0
        console.log(`✅ Cleared ${failedCount || 0} failed emails`)
      }

      // Clear processing emails (stuck in processing state)
      if (statuses.includes('processing')) {
        const { count: processingCount, error: processingError } = await supabase
          .from('communication_events')
          .delete()
          .eq('status', 'processing')

        if (processingError) {
          console.error('❌ Failed to clear processing emails:', processingError)
          throw processingError
        }

        clearedCount += processingCount || 0
        console.log(`✅ Cleared ${processingCount || 0} processing emails`)
      }

      // Log the cleanup operation
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'email_queue_cleared',
          category: 'Email Management',
          message: `Cleared ${clearedCount} emails from queue`,
          new_values: {
            cleared_count: clearedCount,
            cleared_statuses: statuses,
            timestamp: new Date().toISOString()
          }
        })

      if (logError) {
        console.warn('⚠️ Failed to log cleanup operation:', logError)
      }

      return new Response(
        JSON.stringify({
          success: true,
          cleared_count: clearedCount,
          message: `Successfully cleared ${clearedCount} emails from queue`,
          statuses_cleared: statuses
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Reset all failed emails to queued for retry
    if (action === 'retry_failed') {
      const { count: retryCount, error: retryError } = await supabase
        .from('communication_events')
        .update({ 
          status: 'queued',
          retry_count: 0,
          error_message: null,
          last_error: null,
          scheduled_at: new Date().toISOString()
        })
        .eq('status', 'failed')

      if (retryError) {
        console.error('❌ Failed to retry failed emails:', retryError)
        throw retryError
      }

      console.log(`✅ Reset ${retryCount || 0} failed emails for retry`)

      return new Response(
        JSON.stringify({
          success: true,
          retry_count: retryCount || 0,
          message: `Successfully reset ${retryCount || 0} failed emails for retry`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid action. Use "clear_queue" or "retry_failed"'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )

  } catch (error) {
    console.error('❌ Email queue clear operation failed:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to clear email queue'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})