import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CacheHealthMonitor } from '@/components/admin/CacheHealthMonitor';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, Clock, AlertTriangle, CheckCircle, Database } from 'lucide-react';

interface LockInfo {
  order_id: string;
  lock_key: string;
  acquired_by: string;
  acquired_at: string;
  expires_at: string;
  released_at: string | null;
}

interface CacheInfo {
  idempotency_key: string;
  request_data: any;
  response_data: any;
  status: string;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
}

interface OrderUpdateMetrics {
  total_locks: number;
  active_locks: number;
  expired_locks: number;
  cache_entries: number;
  successful_updates: number;
  failed_updates: number;
}

export const OrderUpdateMonitor = () => {
  const [metrics, setMetrics] = useState<OrderUpdateMetrics | null>(null);
  const [locks, setLocks] = useState<LockInfo[]>([]);
  const [cacheEntries, setCacheEntries] = useState<CacheInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      // Fetch active locks
      const { data: locksData } = await supabase
        .from('order_update_locks')
        .select('*')
        .order('acquired_at', { ascending: false })
        .limit(20);

      // Fetch recent cache entries
      const { data: cacheData } = await supabase
        .from('request_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      // Calculate metrics
      const now = new Date();
      const activeLocks = locksData?.filter(lock => 
        !lock.released_at && new Date(lock.expires_at) > now
      ).length || 0;

      const expiredLocks = locksData?.filter(lock => 
        !lock.released_at && new Date(lock.expires_at) <= now
      ).length || 0;

      const successfulUpdates = cacheData?.filter(entry => 
        entry.status === 'success'
      ).length || 0;

      const failedUpdates = cacheData?.filter(entry => 
        entry.status === 'failed'
      ).length || 0;

      setMetrics({
        total_locks: locksData?.length || 0,
        active_locks: activeLocks,
        expired_locks: expiredLocks,
        cache_entries: cacheData?.length || 0,
        successful_updates: successfulUpdates,
        failed_updates: failedUpdates
      });

      setLocks(locksData || []);
      setCacheEntries(cacheData || []);
    } catch (error: any) {
      toast.error(`Failed to fetch metrics: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupExpiredLocks = async () => {
    try {
      // Update expired locks directly
      const { error } = await supabase
        .from('order_update_locks')
        .update({ released_at: new Date().toISOString() })
        .is('released_at', null)
        .lt('expires_at', new Date().toISOString());
      
      if (error) throw error;
      toast.success('Expired locks cleaned up successfully');
      fetchMetrics();
    } catch (error: any) {
      toast.error(`Cleanup failed: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLockStatus = (lock: LockInfo) => {
    if (lock.released_at) return 'released';
    const now = new Date();
    const expiresAt = new Date(lock.expires_at);
    return expiresAt > now ? 'active' : 'expired';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Order Update System Monitor
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchMetrics}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={cleanupExpiredLocks}
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Cleanup Expired
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{metrics.total_locks}</div>
                <div className="text-sm text-gray-600">Total Locks</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{metrics.active_locks}</div>
                <div className="text-sm text-gray-600">Active Locks</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{metrics.expired_locks}</div>
                <div className="text-sm text-gray-600">Expired Locks</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{metrics.cache_entries}</div>
                <div className="text-sm text-gray-600">Cache Entries</div>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">{metrics.successful_updates}</div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{metrics.failed_updates}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Order Locks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {locks.map((lock) => (
                <div key={lock.lock_key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-mono text-sm">{lock.order_id}</div>
                    <div className="text-xs text-gray-500">{lock.acquired_by}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      getLockStatus(lock) === 'active' ? 'bg-green-100 text-green-800' :
                      getLockStatus(lock) === 'expired' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {getLockStatus(lock)}
                    </Badge>
                    <div className="text-xs text-gray-500">
                      {new Date(lock.acquired_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Request Cache Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {cacheEntries.map((entry) => (
                <div key={entry.idempotency_key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-mono text-xs truncate max-w-48">{entry.idempotency_key}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(entry.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(entry.status)}>
                      {entry.status}
                    </Badge>
                    {entry.completed_at && (
                      <div className="text-xs text-gray-500">
                        {Math.round((new Date(entry.completed_at).getTime() - new Date(entry.created_at).getTime()) / 1000)}s
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};