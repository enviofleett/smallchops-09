import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CacheHealthData {
  total_entries: number;
  processing_entries: number;
  success_entries: number;
  failed_entries: number;
  stuck_entries: number;
  oldest_processing: string | null;
}

interface CleanupResult {
  expired_cleaned: number;
  stuck_processing_fixed: number;
}

export const CacheHealthMonitor: React.FC = () => {
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Fetch cache health data
  const { data: healthData, isLoading, refetch } = useQuery<CacheHealthData>({
    queryKey: ['cache-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_cache')
        .select('status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const total_entries = data?.length || 0;
      const processing_entries = data?.filter(entry => entry.status === 'processing').length || 0;
      const success_entries = data?.filter(entry => entry.status === 'success').length || 0;
      const failed_entries = data?.filter(entry => entry.status === 'failed').length || 0;
      const stuck_entries = data?.filter(entry => 
        entry.status === 'processing' && new Date(entry.created_at) < fiveMinutesAgo
      ).length || 0;
      
      const oldestProcessing = data
        ?.filter(entry => entry.status === 'processing')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        [0]?.created_at || null;

      return {
        total_entries,
        processing_entries,
        success_entries,
        failed_entries,
        stuck_entries,
        oldest_processing: oldestProcessing
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      // Use enhanced cleanup with aggressive threshold
      const { data: result, error } = await supabase.rpc('cleanup_stuck_request_cache', {
        p_minutes_threshold: 2 // More aggressive cleanup
      });
      
      if (error) {
        toast.error('Failed to cleanup cache');
        console.error('Cleanup error:', error);
      } else {
        const totalCleaned = ((result as any)?.expired_cleaned || 0) + ((result as any)?.stuck_cleaned || 0);
        toast.success(`Cache cleanup completed: ${totalCleaned} entries removed`);
        // Refetch data to show updated counts
        refetch();
      }
    } catch (error) {
      toast.error('An error occurred during cleanup');
      console.error('Cleanup error:', error);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const getHealthStatus = () => {
    if (!healthData) return 'unknown';
    if (healthData.stuck_entries > 0) return 'critical';
    if (healthData.processing_entries > 5) return 'warning';
    return 'healthy';
  };

  const healthStatus = getHealthStatus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cache Health</CardTitle>
          <Loader2 className="h-4 w-4 animate-spin" />
        </CardHeader>
        <CardContent>
          <div>Loading cache health data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Cache Health Monitor
            {healthStatus === 'healthy' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {healthStatus === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
            {healthStatus === 'critical' && <AlertTriangle className="h-4 w-4 text-red-500" />}
          </CardTitle>
          <CardDescription>Request cache and idempotency status</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanup}
            disabled={isCleaningUp}
          >
            {isCleaningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cleanup'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Entries</p>
            <p className="text-lg font-medium">{healthData?.total_entries || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Processing</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-medium">{healthData?.processing_entries || 0}</p>
              {(healthData?.processing_entries || 0) > 5 && (
                <Badge variant="destructive" className="text-xs">High</Badge>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Success</p>
            <p className="text-lg font-medium text-green-600">{healthData?.success_entries || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-lg font-medium text-red-600">{healthData?.failed_entries || 0}</p>
          </div>
        </div>
        
        {(healthData?.stuck_entries || 0) > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm font-medium text-red-800">
                {healthData?.stuck_entries} stuck entries detected
              </p>
            </div>
            <p className="text-xs text-red-600 mt-1">
              These entries have been processing for over 5 minutes and may be causing 409 errors.
            </p>
          </div>
        )}

        {healthData?.oldest_processing && (
          <div className="mt-2 text-xs text-muted-foreground">
            Oldest processing entry: {new Date(healthData.oldest_processing).toLocaleString()}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <Badge variant={
            healthStatus === 'healthy' ? 'default' : 
            healthStatus === 'warning' ? 'secondary' : 'destructive'
          }>
            {healthStatus.toUpperCase()}
          </Badge>
          <div className="text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};