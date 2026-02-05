import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Mail,
  Database,
  Settings,
  ExternalLink,
  RefreshCw,
  Server
} from 'lucide-react';

interface AuditResult {
  category: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: string;
  actionRequired?: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface SystemHealth {
  smtpConfigured: boolean;
  productionMode: boolean;
  templatesReady: boolean;
  securityCompliant: boolean;
  overallScore: number;
}

export const ProductionEmailAudit: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const { toast } = useToast();

  const runComprehensiveAudit = async () => {
    setIsRunningAudit(true);
    const results: AuditResult[] = [];
    
    try {
      // 1. Check SMTP Configuration
      const { data: smtpHealth, error: smtpError } = await supabase.functions.invoke('smtp-auth-healthcheck');
      
      if (smtpError) {
        results.push({
          category: 'SMTP Configuration',
          status: 'fail',
          message: 'SMTP Health Check Failed',
          details: smtpError.message,
          actionRequired: true,
          severity: 'critical'
        });
      } else if (smtpHealth?.success && smtpHealth?.provider?.source === 'function_secrets') {
        results.push({
          category: 'SMTP Configuration',
          status: 'pass',
          message: 'Production SMTP properly configured via Function Secrets',
          severity: 'low'
        });
      } else if (smtpHealth?.provider?.source === 'database') {
        results.push({
          category: 'SMTP Configuration',
          status: 'warning',
          message: 'SMTP using database configuration (not recommended for production)',
          details: 'Configure Function Secrets for production security',
          actionRequired: true,
          severity: 'high'
        });
      } else {
        results.push({
          category: 'SMTP Configuration',
          status: 'fail',
          message: 'SMTP not configured or authentication failed',
          actionRequired: true,
          severity: 'critical'
        });
      }

      // 2. Check Email Templates
      const requiredTemplates = [
        'order_confirmed', 'order_out_for_delivery', 'order_delivered', 
        'order_ready', 'customer_welcome', 'payment_confirmed'
      ];
      
      const { data: templates } = await (supabase as any)
        .from('enhanced_email_templates')
        .select('template_key, is_active')
        .in('template_key', requiredTemplates);
      
      const activeTemplates = templates?.filter(t => t.is_active) || [];
      const missingTemplates = requiredTemplates.filter(key => 
        !activeTemplates.some(t => t.template_key === key)
      );
      
      if (missingTemplates.length === 0) {
        results.push({
          category: 'Email Templates',
          status: 'pass',
          message: 'All critical email templates are active',
          severity: 'low'
        });
      } else {
        results.push({
          category: 'Email Templates',
          status: 'fail',
          message: `${missingTemplates.length} critical templates missing or inactive`,
          details: `Missing: ${missingTemplates.join(', ')}`,
          actionRequired: true,
          severity: 'critical'
        });
      }

      // 3. Check Production Mode
      const productionIndicators = [
        smtpHealth?.provider?.source === 'function_secrets',
        // Add other production mode checks
      ];
      
      const productionReady = productionIndicators.every(indicator => indicator);
      
      results.push({
        category: 'Production Mode',
        status: productionReady ? 'pass' : 'warning',
        message: productionReady ? 'Production mode properly configured' : 'Not in full production mode',
        details: productionReady ? undefined : 'Some components using development configuration',
        actionRequired: !productionReady,
        severity: productionReady ? 'low' : 'high'
      });

      // 4. Security Audit
      const { data: securityCheck } = await supabase.functions.invoke('audit-function-security');
      
      if (securityCheck?.issues?.length > 0) {
        results.push({
          category: 'Security',
          status: 'fail',
          message: `${securityCheck.issues.length} security issues found`,
          details: 'Database functions missing proper security settings',
          actionRequired: true,
          severity: 'critical'
        });
      } else {
        results.push({
          category: 'Security',
          status: 'pass',
          message: 'Security configuration compliant',
          severity: 'low'
        });
      }

      // 5. System Health Check
      const { data: systemStats } = await (supabase as any)
        .from('communication_events')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      const totalEmails = systemStats?.length || 0;
      const failedEmails = systemStats?.filter(e => e.status === 'failed').length || 0;
      const successRate = totalEmails > 0 ? ((totalEmails - failedEmails) / totalEmails) * 100 : 100;
      
      if (successRate >= 95) {
        results.push({
          category: 'Email Delivery',
          status: 'pass',
          message: `Email delivery rate: ${successRate.toFixed(1)}%`,
          severity: 'low'
        });
      } else if (successRate >= 85) {
        results.push({
          category: 'Email Delivery',
          status: 'warning',
          message: `Email delivery rate: ${successRate.toFixed(1)}% (below 95% target)`,
          actionRequired: true,
          severity: 'medium'
        });
      } else {
        results.push({
          category: 'Email Delivery',
          status: 'fail',
          message: `Email delivery rate: ${successRate.toFixed(1)}% (critically low)`,
          actionRequired: true,
          severity: 'critical'
        });
      }

      setAuditResults(results);
      
      // Calculate overall health
      const passCount = results.filter(r => r.status === 'pass').length;
      const totalCount = results.length;
      const criticalIssues = results.filter(r => r.severity === 'critical' && r.status === 'fail').length;
      
      setSystemHealth({
        smtpConfigured: results.find(r => r.category === 'SMTP Configuration')?.status === 'pass' || false,
        productionMode: results.find(r => r.category === 'Production Mode')?.status === 'pass' || false,
        templatesReady: results.find(r => r.category === 'Email Templates')?.status === 'pass' || false,
        securityCompliant: results.find(r => r.category === 'Security')?.status === 'pass' || false,
        overallScore: criticalIssues === 0 ? (passCount / totalCount) * 100 : Math.max(0, ((passCount / totalCount) * 100) - (criticalIssues * 20))
      });

    } catch (error: any) {
      console.error('Audit failed:', error);
      toast({
        title: "Audit Failed",
        description: "Failed to complete production readiness audit",
        variant: "destructive",
      });
    } finally {
      setIsRunningAudit(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runComprehensiveAudit();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-700 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'fail': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Shield className="h-8 w-8 animate-pulse mx-auto mb-2" />
            <p>Running production readiness audit...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalIssues = auditResults.filter(r => r.severity === 'critical' && r.status === 'fail');
  const actionItems = auditResults.filter(r => r.actionRequired);

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Production Email System Audit</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runComprehensiveAudit}
              disabled={isRunningAudit}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRunningAudit ? 'animate-spin' : ''}`} />
              {isRunningAudit ? 'Auditing...' : 'Run Audit'}
            </Button>
          </div>
          <CardDescription>
            Comprehensive audit of email system production readiness
          </CardDescription>
        </CardHeader>
        <CardContent>
          {systemHealth && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Readiness Score</span>
                    <span className="text-sm text-muted-foreground">
                      {systemHealth.overallScore.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={systemHealth.overallScore} className="h-2" />
                </div>
                <Badge variant={systemHealth.overallScore >= 80 ? "default" : criticalIssues.length > 0 ? "destructive" : "secondary"}>
                  {systemHealth.overallScore >= 80 ? 'Production Ready' : 
                   criticalIssues.length > 0 ? 'Critical Issues' : 'Needs Attention'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  {systemHealth.smtpConfigured ? 
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> : 
                    <XCircle className="h-4 w-4 text-red-600" />
                  }
                  <span className="text-sm">SMTP Configured</span>
                </div>
                <div className="flex items-center gap-2">
                  {systemHealth.templatesReady ? 
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> : 
                    <XCircle className="h-4 w-4 text-red-600" />
                  }
                  <span className="text-sm">Templates Ready</span>
                </div>
                <div className="flex items-center gap-2">
                  {systemHealth.productionMode ? 
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> : 
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  }
                  <span className="text-sm">Production Mode</span>
                </div>
                <div className="flex items-center gap-2">
                  {systemHealth.securityCompliant ? 
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> : 
                    <XCircle className="h-4 w-4 text-red-600" />
                  }
                  <span className="text-sm">Security Compliant</span>
                </div>
              </div>
            </div>
          )}

          {criticalIssues.length > 0 && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-700">
                <strong>🚨 CRITICAL: {criticalIssues.length} blocking issues found.</strong> 
                <br />System is NOT ready for production deployment. Immediate action required.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Audit Results */}
      <div className="grid gap-4">
        {auditResults.map((result, index) => (
          <Card key={index} className={`border ${
            result.status === 'fail' && result.severity === 'critical' ? 'border-red-300 bg-red-50' : ''
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.status)}
                  <CardTitle className="text-base">{result.category}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className={`text-xs ${
                    result.severity === 'critical' ? 'border-red-300 text-red-700' :
                    result.severity === 'high' ? 'border-orange-300 text-orange-700' :
                    result.severity === 'medium' ? 'border-yellow-300 text-yellow-700' :
                    'border-green-300 text-green-700'
                  }`}>
                    {result.severity.toUpperCase()}
                  </Badge>
                  <Badge variant={
                    result.status === 'pass' ? 'default' : 
                    result.status === 'warning' ? 'secondary' : 'destructive'
                  }>
                    {result.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm mb-2">{result.message}</p>
              {result.details && (
                <p className="text-xs text-muted-foreground mb-2">{result.details}</p>
              )}
              {result.actionRequired && (
                <Badge variant="outline" className="text-xs">
                  Action Required
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Required Actions ({actionItems.length})
            </CardTitle>
            <CardDescription>
              Items that need attention before production deployment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actionItems.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.category}</p>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                    {item.details && (
                      <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-xs ${
                    item.severity === 'critical' ? 'border-red-300 text-red-700' :
                    item.severity === 'high' ? 'border-orange-300 text-orange-700' :
                    'border-yellow-300 text-yellow-700'
                  }`}>
                    {item.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Production Setup Quick Actions</CardTitle>
          <CardDescription>
            Common setup tasks for production email system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Button variant="outline" asChild>
              <a 
                href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Server className="h-4 w-4" />
                Configure Function Secrets
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
            
            <Button variant="outline" onClick={() => {
              // Navigate to template manager
              window.location.href = '/settings#email-templates';
            }}>
              <Mail className="h-4 w-4 mr-2" />
              Manage Email Templates
            </Button>
          </div>
          
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-2">📋 Production Readiness Checklist</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Configure SMTP Function Secrets (never use database for production)</li>
              <li>• Create all critical email templates with proper variables</li>
              <li>• Enable production mode with EMAIL_PRODUCTION_MODE=true</li>
              <li>• Setup domain authentication (SPF, DKIM, DMARC)</li>
              <li>• Test email delivery with real customer scenarios</li>
              <li>• Configure monitoring and alerting for email failures</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};