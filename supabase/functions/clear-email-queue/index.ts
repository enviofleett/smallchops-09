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
      const BATCH_SIZE = 100 // Delete in smaller batches to avoid timeout
      const BATCH_DELAY_MS = 100 // Small delay between batches

      // Helper function to delete in batches with delay
      const deleteBatch = async (status: string) => {
        let totalDeleted = 0
        let hasMore = true
        let batchNumber = 0

        while (hasMore) {
          batchNumber++
          // Get batch of IDs to delete
          const { data: idsToDelete, error: fetchError } = await supabase
            .from('communication_events')
            .select('id')
            .eq('status', status)
            .limit(BATCH_SIZE)

          if (fetchError) {
            console.error(`❌ Failed to fetch ${status} emails:`, fetchError)
            throw fetchError
          }

          if (!idsToDelete || idsToDelete.length === 0) {
            hasMore = false
            break
          }

          // Delete this batch
          const ids = idsToDelete.map(item => item.id)
          const { error: deleteError } = await supabase
            .from('communication_events')
            .delete()
            .in('id', ids)

          if (deleteError) {
            console.error(`❌ Failed to delete ${status} emails batch:`, deleteError)
            throw deleteError
          }

          totalDeleted += ids.length
          console.log(`✅ Batch ${batchNumber}: Deleted ${ids.length} ${status} emails (${totalDeleted} total)`)

          // If we got less than batch size, we're done
          if (ids.length < BATCH_SIZE) {
            hasMore = false
          } else {
            // Small delay between batches to avoid overwhelming the database
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
          }
        }

        return totalDeleted
      }

      // Clear queued emails in batches
      if (statuses.includes('queued')) {
        const queuedCount = await deleteBatch('queued')
        clearedCount += queuedCount
        console.log(`✅ Cleared ${queuedCount} queued emails total`)
      }

      // Clear failed emails in batches
      if (statuses.includes('failed')) {
        const failedCount = await deleteBatch('failed')
        clearedCount += failedCount
        console.log(`✅ Cleared ${failedCount} failed emails total`)
      }

      // Clear processing emails in batches
      if (statuses.includes('processing')) {
        const processingCount = await deleteBatch('processing')
        clearedCount += processingCount
        console.log(`✅ Cleared ${processingCount} processing emails total`)
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