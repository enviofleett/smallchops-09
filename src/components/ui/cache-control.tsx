import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { useCacheManager } from '@/utils/cacheManager';
import { useToast } from '@/hooks/use-toast';

/**
 * Production Cache Control Component
 * Provides manual cache management for debugging and maintenance
 */

export const CacheControl: React.FC<{ className?: string }> = ({ className }) => {
  const { clearAllCaches, smartRefresh, validateCacheHealth, emergencyCleanup } = useCacheManager();
  const { toast } = useToast();

  const handleClearCache = async () => {
    try {
      await clearAllCaches();
      toast({
        title: "Cache Cleared",
        description: "All caches have been cleared. Fresh data will be loaded.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear cache. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSmartRefresh = async () => {
    try {
      await smartRefresh();
      toast({
        title: "Cache Refreshed",
        description: "Stale data has been refreshed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh cache. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleHealthCheck = () => {
    const health = validateCacheHealth();
    
    if (health.healthy) {
      toast({
        title: "Cache Healthy",
        description: "All cache systems are functioning properly.",
      });
    } else {
      toast({
        title: "Cache Issues Detected",
        description: `Found ${health.issues.length} issues. Consider clearing cache.`,
        variant: "destructive"
      });
      console.warn('Cache health issues:', health.issues);
    }
  };

  const handleEmergencyCleanup = async () => {
    if (confirm('This will clear all caches and reload the page. Continue?')) {
      await emergencyCleanup();
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Cache Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button 
            onClick={handleSmartRefresh}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Smart Refresh
          </Button>
          
          <Button 
            onClick={handleHealthCheck}
            variant="outline"
            size="sm"
          >
            Health Check
          </Button>
          
          <Button 
            onClick={handleClearCache}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear Cache
          </Button>
          
          <Button 
            onClick={handleEmergencyCleanup}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            Emergency
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Use these controls if you see stale data or experience loading issues.
        </div>
      </CardContent>
    </Card>
  );
};