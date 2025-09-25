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
  Server,
  Mail,
  Database,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface ReadinessCheck {
  category: string;
  status: 'ready' | 'warning' | 'critical';
  message: string;
  details?: string;
  actionUrl?: string;
}

export const ProductionReadinessOverview: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [checks, setChecks] = useState<ReadinessCheck[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const { toast } = useToast();

  const runReadinessCheck = async () => {
    setIsLoading(true);
    const results: ReadinessCheck[] = [];

    try {
      // 1. SMTP Configuration Check
      const { data: smtpHealth } = await supabase.functions.invoke('smtp-auth-healthcheck');
      
      if (smtpHealth?.success && smtpHealth?.provider?.source === 'function_secrets') {
        results.push({
          category: 'SMTP Configuration',
          status: 'ready',
          message: 'Function Secrets configured correctly'
        });
      } else if (smtpHealth?.provider?.source === 'database') {
        results.push({
          category: 'SMTP Configuration',
          status: 'warning',
          message: 'Using database configuration (not production-ready)',
          details: 'Configure Function Secrets for security',
          actionUrl: 'https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions'
        });
      } else {
        results.push({
          category: 'SMTP Configuration',
          status: 'critical',
          message: 'SMTP not configured',
          details: 'Configure Function Secrets immediately'
        });
      }

      // 2. Email Templates Check
      const requiredTemplates = ['order_confirmed', 'order_out_for_delivery', 'order_delivered', 'order_ready', 'customer_welcome', 'payment_confirmed'];
      const { data: templates } = await supabase
        .from('enhanced_email_templates')
        .select('template_key, is_active')
        .in('template_key', requiredTemplates);
      
      const activeTemplates = templates?.filter(t => t.is_active) || [];
      const missingCount = requiredTemplates.length - activeTemplates.length;
      
      if (missingCount === 0) {
        results.push({
          category: 'Email Templates',
          status: 'ready',
          message: 'All critical templates configured'
        });
      } else if (missingCount <= 2) {
        results.push({
          category: 'Email Templates',
          status: 'warning',
          message: `${missingCount} templates missing`,
          details: 'Some email types may fail'
        });
      } else {
        results.push({
          category: 'Email Templates',
          status: 'critical',
          message: `${missingCount} critical templates missing`,
          details: 'Most emails will fail'
        });
      }

      // 3. Production Mode Check
      const productionMode = smtpHealth?.provider?.source === 'function_secrets';
      
      if (productionMode) {
        results.push({
          category: 'Production Mode',
          status: 'ready',
          message: 'Production mode active'
        });
      } else {
        results.push({
          category: 'Production Mode',
          status: 'warning',
          message: 'Development mode detected',
          details: 'Not secure for production use'
        });
      }

      // 4. Email Delivery Health
      const { data: recentEmails } = await supabase
        .from('communication_events')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50);
      
      if (recentEmails && recentEmails.length > 0) {
        const successRate = (recentEmails.filter(e => e.status === 'sent').length / recentEmails.length) * 100;
        
        if (successRate >= 95) {
          results.push({
            category: 'Email Delivery',
            status: 'ready',
            message: `${successRate.toFixed(1)}% delivery success`
          });
        } else if (successRate >= 85) {
          results.push({
            category: 'Email Delivery',
            status: 'warning',
            message: `${successRate.toFixed(1)}% delivery rate (below target)`
          });
        } else {
          results.push({
            category: 'Email Delivery',
            status: 'critical',
            message: `${successRate.toFixed(1)}% delivery rate (critically low)`
          });
        }
      } else {
        results.push({
          category: 'Email Delivery',
          status: 'ready',
          message: 'No recent email data (system ready)'
        });
      }

      setChecks(results);
      
      // Calculate overall score
      const readyCount = results.filter(r => r.status === 'ready').length;
      const warningCount = results.filter(r => r.status === 'warning').length;
      const criticalCount = results.filter(r => r.status === 'critical').length;
      
      const score = ((readyCount * 100) + (warningCount * 60) + (criticalCount * 0)) / results.length;
      setOverallScore(Math.round(score));

    } catch (error: any) {
      console.error('Readiness check failed:', error);
      toast({
        title: "Check Failed",
        description: "Failed to complete readiness assessment",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runReadinessCheck();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const criticalIssues = checks.filter(c => c.status === 'critical').length;
  const isProductionReady = criticalIssues === 0 && overallScore >= 80;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Production Readiness Assessment</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={runReadinessCheck} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Checking...' : 'Refresh'}
            </Button>
          </div>
          <CardDescription>
            Overall email system readiness for production deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Readiness</span>
              <Badge variant={isProductionReady ? "default" : criticalIssues > 0 ? "destructive" : "secondary"}>
                {isProductionReady ? "PRODUCTION READY" : criticalIssues > 0 ? "CRITICAL ISSUES" : "NEEDS ATTENTION"}
              </Badge>
            </div>
            
            <Progress value={overallScore} className="h-3" />
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{overallScore}% Ready</span>
              <span>{criticalIssues} Critical Issues</span>
            </div>
          </div>

          {criticalIssues > 0 && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                <strong>🚨 BLOCKING ISSUES:</strong> {criticalIssues} critical problems must be fixed before production deployment.
                Email system will fail without these fixes.
              </AlertDescription>
            </Alert>
          )}

          {isProductionReady && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                <strong>✅ PRODUCTION READY:</strong> Email system is configured and ready for deployment!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {checks.map((check, index) => (
          <Card key={index} className={`${
            check.status === 'critical' ? 'border-red-300 bg-red-50' :
            check.status === 'warning' ? 'border-yellow-300 bg-yellow-50' :
            'border-green-300 bg-green-50'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <h4 className="font-medium">{check.category}</h4>
                    <p className="text-sm text-muted-foreground">{check.message}</p>
                    {check.details && (
                      <p className="text-xs text-muted-foreground mt-1">{check.details}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant={
                    check.status === 'ready' ? 'default' :
                    check.status === 'warning' ? 'secondary' : 'destructive'
                  } className="text-xs">
                    {check.status.toUpperCase()}
                  </Badge>
                  {check.actionUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={check.actionUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🚀 Next Steps</CardTitle>
          <CardDescription>
            Actions to take based on current readiness status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isProductionReady ? (
            <div className="space-y-3">
              <p className="text-green-700 font-medium">✅ System is production ready!</p>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Monitor email delivery rates after deployment</li>
                <li>• Set up alerting for failed deliveries</li>
                <li>• Configure domain authentication (SPF, DKIM, DMARC)</li>
                <li>• Test with real customer scenarios</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-red-700 font-medium">🚨 Fix issues before production:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Configure Function Secrets with SMTP credentials</li>
                <li>Create missing email templates</li>
                <li>Test email delivery thoroughly</li>
                <li>Enable production mode (EMAIL_PRODUCTION_MODE=true)</li>
              </ol>
              
              <div className="flex gap-2 mt-4">
                <Button variant="outline" asChild>
                  <a 
                    href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Server className="h-4 w-4 mr-2" />
                    Configure Function Secrets
                  </a>
                </Button>
                <Button variant="outline" onClick={() => window.location.hash = '#email-templates'}>
                  <Mail className="h-4 w-4 mr-2" />
                  Manage Templates
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};