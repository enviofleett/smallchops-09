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
        const { data: queuedData, error: queuedError } = await supabase
          .from('communication_events')
          .delete()
          .eq('status', 'queued')
          .select('id', { count: 'exact' })

        if (queuedError) {
          console.error('❌ Failed to clear queued emails:', queuedError)
          throw queuedError
        }

        const queuedCount = queuedData?.length || 0
        clearedCount += queuedCount
        console.log(`✅ Cleared ${queuedCount} queued emails`)
      }

      // Clear failed emails
      if (statuses.includes('failed')) {
        const { data: failedData, error: failedError } = await supabase
          .from('communication_events')
          .delete()
          .eq('status', 'failed')
          .select('id', { count: 'exact' })

        if (failedError) {
          console.error('❌ Failed to clear failed emails:', failedError)
          throw failedError
        }

        const failedCount = failedData?.length || 0
        clearedCount += failedCount
        console.log(`✅ Cleared ${failedCount} failed emails`)
      }

      // Clear processing emails (stuck in processing state)
      if (statuses.includes('processing')) {
        const { data: processingData, error: processingError } = await supabase
          .from('communication_events')
          .delete()
          .eq('status', 'processing')
          .select('id', { count: 'exact' })

        if (processingError) {
          console.error('❌ Failed to clear processing emails:', processingError)
          throw processingError
        }

        const processingCount = processingData?.length || 0
        clearedCount += processingCount
        console.log(`✅ Cleared ${processingCount} processing emails`)
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
      const { data: retryData, error: retryError } = await supabase
        .from('communication_events')
        .update({ 
          status: 'queued',
          retry_count: 0,
          error_message: null,
          last_error: null,
          scheduled_at: new Date().toISOString()
        })
        .eq('status', 'failed')
        .select('id', { count: 'exact' })

      if (retryError) {
        console.error('❌ Failed to retry failed emails:', retryError)
        throw retryError
      }

      const retryCount = retryData?.length || 0
      console.log(`✅ Reset ${retryCount} failed emails for retry`)

      return new Response(
        JSON.stringify({
          success: true,
          retry_count: retryCount,
          message: `Successfully reset ${retryCount} failed emails for retry`
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