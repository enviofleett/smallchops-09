import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Shield, 
  CreditCard, 
  Database,
  Server,
  Eye,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProductionCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  category: 'security' | 'payment' | 'database' | 'environment';
}

interface ProductionReadiness {
  is_production_ready: boolean;
  status: 'ready' | 'needs_attention' | 'not_ready';
  issues: string[];
  issue_count: number;
  payment_safety?: any;
  last_check: string;
}

interface SecurityAudit {
  is_secure: boolean;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  issues: string[];
  total_issues: number;
  critical_issues: number;
  last_audit: string;
}

export const ProductionReadinessDashboard: React.FC = () => {
  const [readiness, setReadiness] = useState<ProductionReadiness | null>(null);
  const [security, setSecurity] = useState<SecurityAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchProductionStatus = async () => {
    try {
      setRefreshing(true);
      
      // Check production readiness
      const { data: readinessData, error: readinessError } = await supabase
        .rpc('check_production_readiness');
      
      if (readinessError) {
        console.error('Production readiness check failed:', readinessError);
        toast({
          title: "Production Check Failed",
          description: "Unable to check production readiness status",
          variant: "destructive"
        });
      } else if (readinessData) {
        setReadiness(readinessData as unknown as ProductionReadiness);
      }

      // Run security audit
      const { data: securityData, error: securityError } = await supabase
        .rpc('run_security_audit');
      
      if (securityError) {
        console.error('Security audit failed:', securityError);
        toast({
          title: "Security Audit Failed", 
          description: "Unable to run security audit",
          variant: "destructive"
        });
      } else if (securityData) {
        setSecurity(securityData as unknown as SecurityAudit);
      }

    } catch (error) {
      console.error('Error fetching production status:', error);
      toast({
        title: "System Error",
        description: "Failed to fetch production status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProductionStatus();
  }, []);

  const getStatusIcon = (status: string, size = 20) => {
    switch (status) {
      case 'ready':
      case 'pass':
        return <CheckCircle className={`text-green-600`} size={size} />;
      case 'needs_attention':
      case 'warning':
        return <AlertTriangle className={`text-yellow-600`} size={size} />;
      case 'not_ready':
      case 'fail':
        return <XCircle className={`text-red-600`} size={size} />;
      default:
        return <AlertTriangle className={`text-gray-500`} size={size} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'ready': 'default',
      'needs_attention': 'secondary', 
      'not_ready': 'destructive',
      'LOW': 'default',
      'MEDIUM': 'secondary',
      'HIGH': 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600'; 
      case 'HIGH': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="animate-spin" size={20} />
          <span>Running production readiness checks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Production Readiness</h2>
          <p className="text-muted-foreground">
            Comprehensive system health and go-live readiness assessment
          </p>
        </div>
        <Button 
          onClick={fetchProductionStatus}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} size={16} />
          Refresh Status
        </Button>
      </div>

      {/* Overall Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Production Ready</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getStatusIcon(readiness?.status || 'not_ready')}
              {getStatusBadge(readiness?.status || 'not_ready')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {readiness?.issue_count || 0} issues detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Level</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`font-medium ${getRiskColor(security?.risk_level || 'HIGH')}`}>
                {security?.risk_level || 'UNKNOWN'}
              </div>
              {getStatusBadge(security?.risk_level || 'HIGH')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {security?.critical_issues || 0} critical issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment System</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getStatusIcon(
                readiness?.payment_safety?.is_safe ? 'pass' : 'fail'
              )}
              <span className="font-medium">
                {readiness?.payment_safety?.is_safe ? 'Secure' : 'Issues Found'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {readiness?.payment_safety?.issue_count || 0} payment issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Health</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getStatusIcon(
                security?.critical_issues === 0 ? 'pass' : 'fail'
              )}
              <span className="font-medium">
                {security?.critical_issues === 0 ? 'Healthy' : 'Critical Issues'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              RLS and security policies
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Issues */}
      {(readiness?.issues?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-yellow-600" size={20} />
              Production Issues
            </CardTitle>
            <CardDescription>
              The following issues must be resolved before going live
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {readiness?.issues?.map((issue, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{issue}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Issues */}
      {(security?.issues?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="text-red-600" size={20} />
              Security Issues
            </CardTitle>
            <CardDescription>
              Security vulnerabilities that require immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {security?.issues?.map((issue, index) => (
                <Alert 
                  key={index} 
                  variant={issue.includes('CRITICAL') ? 'destructive' : 'default'}
                >
                  {issue.includes('CRITICAL') ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertDescription>{issue}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Go-Live Status */}
      {readiness?.is_production_ready && security?.is_secure && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="text-green-600" size={24} />
              Ready for Production!
            </CardTitle>
            <CardDescription className="text-green-700">
              All critical systems are secure and properly configured for go-live
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium text-green-800">✅ Verified Systems</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Payment processing secured</li>
                  <li>• Database access controlled</li>
                  <li>• Business settings configured</li>
                  <li>• Security policies enforced</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-green-800">🚀 Next Steps</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Configure live Paystack keys</li>
                  <li>• Set production domain settings</li>
                  <li>• Enable production monitoring</li>
                  <li>• Conduct final testing</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Check Info */}
      <div className="text-sm text-muted-foreground text-center">
        Last checked: {readiness?.last_check ? new Date(readiness.last_check).toLocaleString() : 'Never'}
      </div>
    </div>
  );
};