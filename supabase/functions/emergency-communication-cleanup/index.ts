import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧹 Emergency Communication Cleanup function called');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get user context and verify admin access
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authorization header required'
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid authentication'
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('✅ Admin access verified, proceeding with cleanup...');

    const { action = 'analyze', dryRun = true } = await req.json().catch(() => ({}));

    switch (action) {
      case 'analyze':
        return await analyzeCommEvents(supabaseClient);
      
      case 'cleanup_duplicates':
        return await cleanupDuplicates(supabaseClient, dryRun, user.id);
      
      case 'fix_orphaned':
        return await fixOrphanedEvents(supabaseClient, dryRun, user.id);
      
      case 'archive_old':
        return await archiveOldEvents(supabaseClient, dryRun, user.id);
      
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action. Use: analyze, cleanup_duplicates, fix_orphaned, archive_old'
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

  } catch (error) {
    console.error('💥 Emergency cleanup error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error)?.message || 'Emergency cleanup failed'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function analyzeCommEvents(supabaseClient: any) {
  console.log('📊 Analyzing communication events...');

  // Get basic stats
  const { data: totalCount } = await supabaseClient
    .from('communication_events')
    .select('id', { count: 'exact', head: true });

  const { data: duplicateStats } = await supabaseClient
    .from('communication_events')
    .select('order_id, event_type, recipient_email', { count: 'exact' })
    .not('order_id', 'is', null);

  // Check for events without valid orders
  const { data: orphanedEvents } = await supabaseClient
    .from('communication_events')
    .select(`
      id,
      order_id,
      event_type,
      recipient_email,
      created_at
    `)
    .not('order_id', 'is', null)
    .not('order_id', 'in', `(SELECT id FROM orders)`);

  // Check status distribution
  const { data: statusDistribution } = await supabaseClient
    .from('communication_events')
    .select('status', { count: 'exact' });

  // Check for stuck processing events
  const { data: stuckEvents } = await supabaseClient
    .from('communication_events')
    .select('id, event_type, status, created_at, processing_started_at')
    .eq('status', 'processing')
    .lt('processing_started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // 30 minutes ago

  // Check recent error patterns
  const { data: recentErrors } = await supabaseClient
    .from('communication_events')
    .select('error_message, event_type', { count: 'exact' })
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

  const analysis = {
    total_events: totalCount?.length || 0,
    orphaned_events: orphanedEvents?.length || 0,
    stuck_processing: stuckEvents?.length || 0,
    recent_failures: recentErrors?.length || 0,
    status_distribution: statusDistribution || [],
    orphaned_samples: (orphanedEvents || []).slice(0, 5),
    stuck_samples: (stuckEvents || []).slice(0, 5),
    error_samples: (recentErrors || []).slice(0, 5)
  };

  return new Response(
    JSON.stringify({
      success: true,
      analysis,
      recommendations: generateRecommendations(analysis)
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function cleanupDuplicates(supabaseClient: any, dryRun: boolean, adminId: string) {
  console.log(`🔄 ${dryRun ? 'Analyzing' : 'Cleaning up'} duplicate communication events...`);

  // Find potential duplicates based on order_id, event_type, and recipient_email
  const { data: duplicates } = await supabaseClient
    .from('communication_events')
    .select(`
      id,
      order_id,
      event_type,
      recipient_email,
      created_at,
      status
    `)
    .not('order_id', 'is', null)
    .order('created_at', { ascending: true });

  if (!duplicates || duplicates.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        message: 'No duplicate events found',
        duplicates_removed: 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Group by potential duplicate keys
  const groupedEvents = new Map();
  duplicates.forEach(event => {
    const key = `${event.order_id}_${event.event_type}_${event.recipient_email}`;
    if (!groupedEvents.has(key)) {
      groupedEvents.set(key, []);
    }
    groupedEvents.get(key).push(event);
  });

  // Find groups with duplicates (more than 1 event)
  const duplicateGroups = Array.from(groupedEvents.values()).filter(group => group.length > 1);
  
  let toRemove = [];
  duplicateGroups.forEach(group => {
    // Keep the first successful one, or the latest one if none successful
    const successful = group.find(e => e.status === 'sent');
    if (successful) {
      toRemove.push(...group.filter(e => e.id !== successful.id));
    } else {
      // Keep the latest, remove the rest
      const latest = group[group.length - 1];
      toRemove.push(...group.filter(e => e.id !== latest.id));
    }
  });

  if (dryRun) {
    return new Response(
      JSON.stringify({
        success: true,
        message: `Found ${toRemove.length} duplicate events that would be removed`,
        duplicate_groups: duplicateGroups.length,
        samples: toRemove.slice(0, 10),
        dry_run: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Actually remove duplicates
  if (toRemove.length > 0) {
    const { error } = await supabaseClient
      .from('communication_events')
      .delete()
      .in('id', toRemove.map(e => e.id));

    if (error) {
      throw new Error(`Failed to remove duplicates: ${error.message}`);
    }

    // Log the cleanup
    await supabaseClient
      .from('audit_logs')
      .insert({
        action: 'communication_duplicates_cleaned',
        category: 'Data Cleanup',
        message: `Removed ${toRemove.length} duplicate communication events`,
        user_id: adminId,
        new_values: { removed_count: toRemove.length, duplicate_groups: duplicateGroups.length }
      });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Successfully removed ${toRemove.length} duplicate events`,
      duplicates_removed: toRemove.length,
      duplicate_groups: duplicateGroups.length
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function fixOrphanedEvents(supabaseClient: any, dryRun: boolean, adminId: string) {
  console.log(`🔄 ${dryRun ? 'Analyzing' : 'Fixing'} orphaned communication events...`);

  // Find events with invalid order references
  const { data: orphaned } = await supabaseClient
    .from('communication_events')
    .select('id, order_id, event_type, recipient_email, created_at')
    .not('order_id', 'is', null)
    .not('order_id', 'in', `(SELECT id FROM orders)`);

  if (!orphaned || orphaned.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        message: 'No orphaned events found',
        orphaned_fixed: 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  if (dryRun) {
    return new Response(
      JSON.stringify({
        success: true,
        message: `Found ${orphaned.length} orphaned events that would be fixed`,
        samples: orphaned.slice(0, 10),
        dry_run: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Set orphaned events' order_id to null instead of deleting them
  const { error } = await supabaseClient
    .from('communication_events')
    .update({ order_id: null })
    .in('id', orphaned.map(e => e.id));

  if (error) {
    throw new Error(`Failed to fix orphaned events: ${error.message}`);
  }

  // Log the fix
  await supabaseClient
    .from('audit_logs')
    .insert({
      action: 'communication_orphaned_fixed',
      category: 'Data Cleanup',
      message: `Fixed ${orphaned.length} orphaned communication events`,
      user_id: adminId,
      new_values: { fixed_count: orphaned.length }
    });

  return new Response(
    JSON.stringify({
      success: true,
      message: `Successfully fixed ${orphaned.length} orphaned events`,
      orphaned_fixed: orphaned.length
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function archiveOldEvents(supabaseClient: any, dryRun: boolean, adminId: string) {
  console.log(`🔄 ${dryRun ? 'Analyzing' : 'Archiving'} old communication events...`);

  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago

  // Find old completed events
  const { data: oldEvents } = await supabaseClient
    .from('communication_events')
    .select('*')
    .in('status', ['sent', 'failed'])
    .lt('created_at', cutoffDate);

  if (!oldEvents || oldEvents.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        message: 'No old events found for archiving',
        archived_count: 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  if (dryRun) {
    return new Response(
      JSON.stringify({
        success: true,
        message: `Found ${oldEvents.length} old events that would be archived`,
        cutoff_date: cutoffDate,
        dry_run: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Move to archive table
  const { error: archiveError } = await supabaseClient
    .from('communication_events_archive')
    .insert(oldEvents);

  if (archiveError) {
    throw new Error(`Failed to archive events: ${archiveError.message}`);
  }

  // Remove from main table
  const { error: deleteError } = await supabaseClient
    .from('communication_events')
    .delete()
    .in('id', oldEvents.map(e => e.id));

  if (deleteError) {
    throw new Error(`Failed to remove archived events: ${deleteError.message}`);
  }

  // Log the archival
  await supabaseClient
    .from('audit_logs')
    .insert({
      action: 'communication_events_archived',
      category: 'Data Cleanup',
      message: `Archived ${oldEvents.length} old communication events`,
      user_id: adminId,
      new_values: { archived_count: oldEvents.length, cutoff_date: cutoffDate }
    });

  return new Response(
    JSON.stringify({
      success: true,
      message: `Successfully archived ${oldEvents.length} old events`,
      archived_count: oldEvents.length
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

function generateRecommendations(analysis: any) {
  const recommendations = [];

  if (analysis.orphaned_events > 0) {
    recommendations.push({
      priority: 'high',
      action: 'fix_orphaned',
      description: `Fix ${analysis.orphaned_events} orphaned events with invalid order references`
    });
  }

  if (analysis.stuck_processing > 0) {
    recommendations.push({
      priority: 'medium',
      action: 'cleanup_duplicates',
      description: `Reset ${analysis.stuck_processing} stuck processing events`
    });
  }

  if (analysis.total_events > 10000) {
    recommendations.push({
      priority: 'low',
      action: 'archive_old',
      description: 'Archive old completed events to improve performance'
    });
  }

  if (analysis.recent_failures > 50) {
    recommendations.push({
      priority: 'medium',
      action: 'investigate_failures',
      description: `Investigate ${analysis.recent_failures} recent failures for patterns`
    });
  }

  return recommendations;
}
