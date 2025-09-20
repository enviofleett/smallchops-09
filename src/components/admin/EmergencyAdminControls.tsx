import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAdminErrorStore } from '@/stores/adminErrorStore';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  Zap, 
  RefreshCw, 
  Shield, 
  Clock, 
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  Settings
} from 'lucide-react';

interface LockInfo {
  orderId: string;
  lockingAdminId: string;
  lockingAdminName: string;
  lockedAt: string;
  status: 'active' | 'expired' | 'released';
}

interface EmergencyAdminControlsProps {
  show409Error?: string | null;
  onBypassSuccess?: (orderId: string) => void;
  className?: string;
}

export const EmergencyAdminControls: React.FC<EmergencyAdminControlsProps> = ({
  show409Error,
  onBypassSuccess,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeLocks, setActiveLocks] = useState<LockInfo[]>([]);
  const [batchCleanupProgress, setBatchCleanupProgress] = useState(0);
  const [isPerformingBatchCleanup, setIsPerformingBatchCleanup] = useState(false);
  const [emergencyBypassActive, setEmergencyBypassActive] = useState(false);
  
  const { 
    errors, 
    getUnresolvedErrors, 
    clearResolvedErrors, 
    enableRecoveryMode, 
    disableRecoveryMode,
    isRecoveryMode 
  } = useAdminErrorStore();
  
  const { retry, reset, canRetry, isRetrying } = useErrorRecovery({
    maxRetries: 5,
    retryDelay: 2000,
    onMaxRetriesExceeded: (error) => {
      toast.error('Emergency recovery failed. Manual intervention required.');
    }
  });

  // Show controls when there are 409 errors or critical issues
  useEffect(() => {
    const unresolvedErrors = getUnresolvedErrors();
    const hasCriticalErrors = unresolvedErrors.some(error => 
      ['conflict', 'auth'].includes(error.errorType)
    );
    
    setIsVisible(Boolean(show409Error) || hasCriticalErrors || isRecoveryMode);
  }, [show409Error, errors, isRecoveryMode, getUnresolvedErrors]);

  // Fetch active locks
  const fetchActiveLocks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: { action: 'get_active_locks' }
      });

      if (error) throw error;
      setActiveLocks(data?.locks || []);
    } catch (error) {
      console.error('Failed to fetch active locks:', error);
    }
  };

  // Batch cache cleanup
  const performBatchCleanup = async () => {
    setIsPerformingBatchCleanup(true);
    setBatchCleanupProgress(0);
    
    try {
      const totalSteps = 4;
      
      // Step 1: Clear expired locks
      setBatchCleanupProgress(25);
      await supabase.functions.invoke('admin-orders-manager', {
        body: { action: 'clear_expired_locks' }
      });

      // Step 2: Clear stale cache entries
      setBatchCleanupProgress(50);
      await supabase.functions.invoke('admin-orders-manager', {
        body: { action: 'clear_stale_cache' }
      });

      // Step 3: Reset error states
      setBatchCleanupProgress(75);
      clearResolvedErrors();
      reset();

      // Step 4: Invalidate query cache
      setBatchCleanupProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success('Batch cleanup completed successfully');
      await fetchActiveLocks();
    } catch (error) {
      console.error('Batch cleanup failed:', error);
      toast.error('Batch cleanup failed. Some issues may require manual resolution.');
    } finally {
      setIsPerformingBatchCleanup(false);
      setBatchCleanupProgress(0);
    }
  };

  // Emergency bypass for super admins
  const performEmergencyBypass = async (orderId: string) => {
    setEmergencyBypassActive(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'emergency_override',
          orderId,
          reason: 'emergency_admin_bypass'
        }
      });

      if (error) throw error;
      
      toast.success('Emergency bypass completed');
      onBypassSuccess?.(orderId);
      await fetchActiveLocks();
    } catch (error) {
      console.error('Emergency bypass failed:', error);
      toast.error('Emergency bypass failed. Please contact system administrator.');
    } finally {
      setEmergencyBypassActive(false);
    }
  };

  // Load initial data
  useEffect(() => {
    if (isVisible) {
      fetchActiveLocks();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const unresolvedErrors = getUnresolvedErrors();
  const conflictErrors = unresolvedErrors.filter(error => error.errorType === 'conflict');

  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-md ${className}`}>
      <Card className="border-orange-200 bg-orange-50 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            Emergency Admin Controls
          </CardTitle>
          <CardDescription className="text-orange-700">
            Critical error recovery and administrative overrides
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Recovery Mode Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Recovery Mode</span>
            <Button
              variant={isRecoveryMode ? "destructive" : "outline"}
              size="sm"
              onClick={isRecoveryMode ? disableRecoveryMode : enableRecoveryMode}
            >
              {isRecoveryMode ? 'Disable' : 'Enable'}
            </Button>
          </div>

          {/* Error Summary */}
          {unresolvedErrors.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {unresolvedErrors.length} unresolved errors detected
                {conflictErrors.length > 0 && ` (${conflictErrors.length} conflicts)`}
              </AlertDescription>
            </Alert>
          )}

          {/* Active Locks Display */}
          {activeLocks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Active Locks ({activeLocks.length})
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {activeLocks.map((lock) => (
                  <div key={lock.orderId} className="flex items-center justify-between text-xs p-2 bg-white rounded">
                    <span>Order {lock.orderId}</span>
                    <Badge variant={lock.status === 'active' ? 'destructive' : 'secondary'}>
                      {lock.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchActiveLocks}
              disabled={isRetrying}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={clearResolvedErrors}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Clear Resolved
            </Button>
          </div>

          {/* Batch Cleanup */}
          <div className="space-y-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={performBatchCleanup}
              disabled={isPerformingBatchCleanup}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isPerformingBatchCleanup ? 'Cleaning...' : 'Batch Cache Cleanup'}
            </Button>
            
            {isPerformingBatchCleanup && (
              <Progress value={batchCleanupProgress} className="w-full" />
            )}
          </div>

          {/* Emergency Bypass */}
          {show409Error && (
            <div className="space-y-2 border-t pt-2">
              <h4 className="text-sm font-medium text-red-700 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Emergency Override
              </h4>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => performEmergencyBypass(show409Error)}
                disabled={emergencyBypassActive}
              >
                <Zap className="h-4 w-4 mr-2" />
                {emergencyBypassActive ? 'Bypassing...' : 'Force Override'}
              </Button>
              <p className="text-xs text-red-600">
                ⚠️ Use only when standard bypass fails
              </p>
            </div>
          )}

          {/* Recovery Actions */}
          {isRecoveryMode && (
            <div className="space-y-2 border-t pt-2">
              <h4 className="text-sm font-medium text-blue-700">
                Recovery Actions
              </h4>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retry(async () => {
                    await fetchActiveLocks();
                    return Promise.resolve();
                  })}
                  disabled={!canRetry || isRetrying}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Auto Retry
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reset}
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Reset State
                </Button>
              </div>
            </div>
          )}

          {/* Hide Controls */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setIsVisible(false)}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Hide Controls
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};