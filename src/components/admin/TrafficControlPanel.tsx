import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Shield, Activity, Database, Zap } from 'lucide-react';
import { trafficControl, getUsageStatus, enableFreezeMode, disableFreezeMode, emergencyShutdown } from '@/utils/trafficControl';
import { projectCutover, getProjectStatus, performEmergencyCutover, healthCheckCurrentProject } from '@/utils/projectCutover';
import { toast } from 'sonner';

export default function TrafficControlPanel() {
  const [usageStatus, setUsageStatus] = useState(getUsageStatus());
  const [projectStatus, setProjectStatus] = useState(getProjectStatus());
  const [isHealthy, setIsHealthy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      setUsageStatus(getUsageStatus());
      setProjectStatus(getProjectStatus());
      
      const health = await healthCheckCurrentProject();
      setIsHealthy(health.isHealthy);
      
      if (!health.isHealthy) {
        toast.error(`Project health check failed: ${health.error}`);
      }
    } catch (error) {
      console.error('Failed to refresh status:', error);
      toast.error('Failed to refresh status');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleEmergencyShutdown = () => {
    if (confirm('⚠️ This will immediately block ALL server calls. Continue?')) {
      emergencyShutdown();
      setUsageStatus(getUsageStatus());
      toast.error('Emergency shutdown activated');
    }
  };

  const handleEmergencyCutover = async () => {
    if (confirm('⚠️ This will switch to backup Supabase project. Continue?')) {
      const success = await performEmergencyCutover();
      if (success) {
        setProjectStatus(getProjectStatus());
        toast.success('Emergency cutover completed');
        // Recommend page refresh
        if (confirm('Cutover complete. Refresh page to use new project?')) {
          window.location.reload();
        }
      } else {
        toast.error('Emergency cutover failed - no backup project configured');
      }
    }
  };

  const toggleFreezeMode = () => {
    const status = getUsageStatus();
    const isCurrentlyFrozen = trafficControl['config']?.isFreezeModeEnabled;
    
    if (isCurrentlyFrozen) {
      disableFreezeMode();
      toast.success('Traffic freeze disabled');
    } else {
      enableFreezeMode();
      toast.warning('Traffic freeze enabled - all server calls blocked');
    }
    
    setUsageStatus(getUsageStatus());
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'destructive';
    if (percent >= 70) return 'orange';
    if (percent >= 50) return 'yellow';
    return 'green';
  };

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    return `${minutes}m remaining`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Traffic Control Panel</h2>
          <p className="text-muted-foreground">Monitor and control Supabase usage</p>
        </div>
        <Button onClick={refreshStatus} disabled={refreshing} variant="outline">
          <Activity className="w-4 h-4 mr-2" />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Emergency Controls */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Emergency Controls
          </CardTitle>
          <CardDescription>
            Use these controls when approaching Supabase limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg">
            <div>
              <h4 className="font-medium">Traffic Freeze</h4>
              <p className="text-sm text-muted-foreground">Block all server calls immediately</p>
            </div>
            <Button 
              onClick={toggleFreezeMode}
              variant={trafficControl['config']?.isFreezeModeEnabled ? "default" : "destructive"}
              size="sm"
            >
              {trafficControl['config']?.isFreezeModeEnabled ? 'Unfreeze' : 'Freeze Traffic'}
            </Button>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleEmergencyShutdown}
              variant="destructive"
              className="flex-1"
            >
              <Shield className="w-4 h-4 mr-2" />
              Emergency Shutdown
            </Button>
            
            <Button 
              onClick={handleEmergencyCutover}
              variant="outline"
              className="flex-1"
              disabled={!projectStatus.backup}
            >
              <Database className="w-4 h-4 mr-2" />
              Emergency Cutover
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Current Usage (This Hour)
          </CardTitle>
          <CardDescription>
            Conservative limits to prevent overages • {formatTimeRemaining(usageStatus.timeToReset)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Edge Function Calls</span>
              <span>{usageStatus.edgeFunctionCalls} / {usageStatus.maxEdgeFunctionCalls}</span>
            </div>
            <Progress 
              value={usageStatus.percentUsed} 
              className={`h-2 ${getUsageColor(usageStatus.percentUsed)}`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Egress Usage</span>
              <span>{usageStatus.egressMB}MB / {usageStatus.maxEgressMB}MB</span>
            </div>
            <Progress 
              value={(usageStatus.egressMB / usageStatus.maxEgressMB) * 100} 
              className="h-2"
            />
          </div>

          {usageStatus.isNearLimit && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-sm font-medium text-orange-600">
                ⚠️ Approaching hourly limits - consider enabling freeze mode
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Project Status
          </CardTitle>
          <CardDescription>
            Current Supabase project configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <h4 className="font-medium">{projectStatus.primary.name}</h4>
              <p className="text-sm text-muted-foreground">
                {projectStatus.primary.projectId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {projectStatus.primary.isCurrent && (
                <Badge variant="default">Active</Badge>
              )}
              <Badge variant={isHealthy ? "default" : "destructive"}>
                {isHealthy ? "Healthy" : "Unhealthy"}
              </Badge>
            </div>
          </div>

          {projectStatus.backup && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <h4 className="font-medium">{projectStatus.backup.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {projectStatus.backup.projectId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {projectStatus.backup.isCurrent && (
                  <Badge variant="secondary">Active</Badge>
                )}
                <Badge variant="outline">Backup</Badge>
              </div>
            </div>
          )}

          {!projectStatus.backup && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-sm text-orange-600">
                ⚠️ No backup project configured for emergency cutover
              </p>
            </div>
          )}

          {projectStatus.cutoverActive && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-600">
                ℹ️ Project cutover is currently active
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}