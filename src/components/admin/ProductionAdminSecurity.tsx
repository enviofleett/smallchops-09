import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Clock, 
  Users, 
  Lock,
  CheckCircle,
  RefreshCw,
  XCircle,
  Zap,
  Eye,
  AlertCircle
} from 'lucide-react';
import { useProductionSecurity } from '@/hooks/useProductionSecurity';

export const ProductionAdminSecurity = () => {
  const {
    metrics,
    alerts,
    readiness,
    isLoading,
    isRefreshing,
    fetchSecurityMetrics,
    acknowledgeAlert,
    emergencyLockdown
  } = useProductionSecurity();


  const getSystemHealthColor = (health: string) => {
    switch (health) {
      case 'critical': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  const getThreatLevelBadge = (level: string) => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'default';
    }
  };

  const getAlertSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading security metrics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Production Readiness Banner */}
      {readiness && (
        <Card className={`border-2 ${readiness.isReady ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {readiness.isReady ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                <div>
                  <h3 className={`font-semibold ${readiness.isReady ? 'text-green-800' : 'text-red-800'}`}>
                    {readiness.isReady ? '🚀 Production Ready' : '⚠️ Production Issues Detected'}
                  </h3>
                  <p className={`text-sm ${readiness.isReady ? 'text-green-700' : 'text-red-700'}`}>
                    {readiness.isReady 
                      ? 'All security checks passed. System ready for live deployment.'
                      : `${readiness.criticalIssues.length} critical issues need attention before deployment.`
                    }
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${readiness.isReady ? 'text-green-600' : 'text-red-600'}`}>
                  {readiness.score}/100
                </div>
                <Progress value={readiness.score} className="w-24 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Alerts */}
      {alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <Zap className="h-5 w-5" />
              Security Alerts ({alerts.filter(a => !a.acknowledged).length} unacknowledged)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-white">
                <div className="flex items-center space-x-3">
                  {getAlertSeverityIcon(alert.severity)}
                  <div>
                    <div className="font-medium text-sm">{alert.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  {!alert.acknowledged && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeAdmins || 0}</div>
            <p className="text-xs text-muted-foreground">
              Currently active administrator accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Live Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeSessions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active admin sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security Policies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics?.rlsPoliciesActive || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active RLS policies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${getSystemHealthColor(metrics?.systemHealth || 'unknown')}`}>
              {metrics?.systemHealth || 'Unknown'}
            </div>
            <Badge variant={getThreatLevelBadge(metrics?.threatLevel || 'low')} className="mt-1">
              {metrics?.threatLevel || 'Low'} Threat
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Security Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Production Security Status
            </CardTitle>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchSecurityMetrics}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={emergencyLockdown}
              >
                <Lock className="h-4 w-4 mr-1" />
                Emergency Lockdown
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Authentication Security</span>
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Row Level Security</span>
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Enforced
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Audit Logging</span>
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Failed Login Attempts</span>
                <Badge variant={metrics?.failedLogins && metrics.failedLogins > 0 ? "destructive" : "default"}>
                  {metrics?.failedLogins || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Suspicious Activity</span>
                <Badge variant={metrics?.suspiciousActivity && metrics.suspiciousActivity > 0 ? "destructive" : "default"}>
                  {metrics?.suspiciousActivity || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Last Security Scan</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(metrics?.lastSecurityScan || '').toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Production Readiness Details */}
          {readiness && !readiness.isReady && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {readiness.criticalIssues.length > 0 && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-medium text-red-800">Critical Issues:</div>
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {readiness.criticalIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {readiness.warnings.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-medium text-yellow-800">Warnings:</div>
                      <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                        {readiness.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {readiness?.recommendations && readiness.recommendations.length > 0 && (
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium text-blue-800">Recommendations:</div>
                  <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                    {readiness.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* System Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Production Status Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">
                {metrics?.failedLogins || 0}
              </div>
              <div className="text-xs text-muted-foreground">Failed Logins (24h)</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600">
                {metrics?.suspiciousActivity || 0}
              </div>
              <div className="text-xs text-muted-foreground">Suspicious Events</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {metrics?.rlsPoliciesActive || 0}
              </div>
              <div className="text-xs text-muted-foreground">Security Policies</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {readiness?.score || 0}%
              </div>
              <div className="text-xs text-muted-foreground">Production Score</div>
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <div className="text-xs text-muted-foreground">
              Last updated: {metrics?.lastSecurityScan 
                ? new Date(metrics.lastSecurityScan).toLocaleString()
                : 'Never'
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};