import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Production Communication Event Cleanup Service
 * Automatically cleans up stuck, failed, and duplicate communication events
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🧹 Starting communication event cleanup...')

    let totalCleaned = 0

    // 1. Clean up stuck events (processing for more than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    const { data: stuckEvents, error: stuckError } = await supabase
      .from('communication_events')
      .update({ 
        status: 'failed',
        error_message: 'Event stuck in processing state - marked as failed by cleanup service',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('processing_started_at', thirtyMinutesAgo)
      .select('id')

    if (!stuckError && stuckEvents) {
      totalCleaned += stuckEvents.length
      console.log(`✅ Cleaned up ${stuckEvents.length} stuck events`)
    }

    // 2. Archive old completed events (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: oldEvents, error: oldEventsError } = await supabase
      .from('communication_events')
      .select('*')
      .in('status', ['sent', 'failed'])
      .lt('created_at', thirtyDaysAgo)
      .limit(100) // Process in batches

    if (!oldEventsError && oldEvents && oldEvents.length > 0) {
      // Move to archive table
      const { error: archiveError } = await supabase
        .from('communication_events_archive')
        .insert(oldEvents)

      if (!archiveError) {
        // Delete from main table
        const { error: deleteError } = await supabase
          .from('communication_events')
          .delete()
          .in('id', oldEvents.map(e => e.id))

        if (!deleteError) {
          totalCleaned += oldEvents.length
          console.log(`📦 Archived ${oldEvents.length} old events`)
        }
      }
    }

    // 3. Reset events with excessive retry counts
    const { data: excessiveRetries, error: retryError } = await supabase
      .from('communication_events')
      .update({
        status: 'failed',
        error_message: 'Exceeded maximum retry attempts - marked as failed',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'queued')
      .gte('retry_count', 5)
      .select('id')

    if (!retryError && excessiveRetries) {
      totalCleaned += excessiveRetries.length
      console.log(`🚫 Failed ${excessiveRetries.length} events with excessive retries`)
    }

    // 4. Identify and log potential duplicate events for monitoring
    const { data: duplicates, error: duplicateError } = await supabase
      .from('communication_events')
      .select('order_id, event_type, recipient_email, template_key, count(*)')
      .not('order_id', 'is', null)
      .in('status', ['queued', 'processing'])
      .group('order_id, event_type, recipient_email, template_key')
      .having('count(*) > 1')

    if (!duplicateError && duplicates && duplicates.length > 0) {
      console.log(`⚠️ Found ${duplicates.length} potential duplicate groups for monitoring`)
    }

    // Log cleanup completion
    await supabase
      .from('audit_logs')
      .insert({
        action: 'communication_cleanup_completed',
        category: 'System Maintenance',
        message: `Communication event cleanup completed: ${totalCleaned} events processed`,
        new_values: {
          events_cleaned: totalCleaned,
          cleanup_timestamp: new Date().toISOString(),
          stuck_events: stuckEvents?.length || 0,
          archived_events: oldEvents?.length || 0,
          failed_retries: excessiveRetries?.length || 0,
          potential_duplicates: duplicates?.length || 0
        }
      })

    console.log(`🎉 Cleanup completed: ${totalCleaned} events processed`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Communication event cleanup completed',
      events_cleaned: totalCleaned,
      details: {
        stuck_events: stuckEvents?.length || 0,
        archived_events: oldEvents?.length || 0,
        failed_retries: excessiveRetries?.length || 0,
        potential_duplicates: duplicates?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Cleanup error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Cleanup service failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})