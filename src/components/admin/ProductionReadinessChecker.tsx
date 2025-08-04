import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  critical: boolean;
}

interface ProductionReadiness {
  score: number;
  checks: CheckResult[];
  canDeploy: boolean;
}

export const ProductionReadinessChecker: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [readiness, setReadiness] = useState<ProductionReadiness | null>(null);

  const performChecks = async () => {
    setLoading(true);
    try {
      const checks: CheckResult[] = [];

      // 1. Payment Configuration Check
      const { data: paymentConfig } = await supabase.rpc('get_active_paystack_config');
      const configData = Array.isArray(paymentConfig) ? paymentConfig[0] : paymentConfig;
      
      if (configData?.public_key && configData?.secret_key) {
        checks.push({
          name: 'Payment Configuration',
          status: configData.test_mode ? 'warning' : 'pass',
          message: configData.test_mode 
            ? 'Using test keys - switch to live keys for production'
            : 'Live payment keys configured',
          critical: true
        });
      } else {
        checks.push({
          name: 'Payment Configuration',
          status: 'fail',
          message: 'Payment configuration incomplete',
          critical: true
        });
      }

      // 2. Webhook Configuration Check
      const { data: envConfig } = await supabase
        .from('environment_config')
        .select('webhook_url, is_live_mode')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (envConfig?.webhook_url) {
        checks.push({
          name: 'Webhook Configuration',
          status: envConfig.webhook_url.includes('localhost') ? 'warning' : 'pass',
          message: envConfig.webhook_url.includes('localhost')
            ? 'Webhook URL points to localhost - update for production'
            : 'Production webhook URL configured',
          critical: true
        });
      } else {
        checks.push({
          name: 'Webhook Configuration',
          status: 'fail',
          message: 'Webhook URL not configured',
          critical: true
        });
      }

      // 3. Business Settings Check
      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('name, email, logo_url, seo_title, seo_description')
        .limit(1)
        .single();

      if (businessSettings) {
        const hasBasicInfo = businessSettings.name && businessSettings.email;
        const hasBranding = businessSettings.logo_url;
        const hasSEO = businessSettings.seo_title && businessSettings.seo_description;

        checks.push({
          name: 'Business Information',
          status: hasBasicInfo ? 'pass' : 'fail',
          message: hasBasicInfo ? 'Business details configured' : 'Missing business name or email',
          critical: false
        });

        checks.push({
          name: 'Branding Assets',
          status: hasBranding ? 'pass' : 'warning',
          message: hasBranding ? 'Logo configured' : 'Logo not uploaded',
          critical: false
        });

        checks.push({
          name: 'SEO Configuration',
          status: hasSEO ? 'pass' : 'warning',
          message: hasSEO ? 'SEO metadata configured' : 'SEO title/description missing',
          critical: false
        });
      }

      // 4. Security Check
      const { data: securityIncidents } = await supabase
        .from('security_incidents')
        .select('severity')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq('severity', 'critical');

      checks.push({
        name: 'Security Status',
        status: (securityIncidents?.length || 0) > 0 ? 'warning' : 'pass',
        message: (securityIncidents?.length || 0) > 0 
          ? `${securityIncidents?.length} critical security incidents in last 24h`
          : 'No critical security incidents',
        critical: true
      });

      // 5. Database Health Check
      try {
        await supabase.from('products').select('id').limit(1);
        checks.push({
          name: 'Database Connection',
          status: 'pass',
          message: 'Database accessible',
          critical: true
        });
      } catch (error) {
        checks.push({
          name: 'Database Connection',
          status: 'fail',
          message: 'Database connection failed',
          critical: true
        });
      }

      // Calculate score and deployment readiness
      const totalChecks = checks.length;
      const passedChecks = checks.filter(c => c.status === 'pass').length;
      const failedCritical = checks.filter(c => c.status === 'fail' && c.critical).length;
      
      const score = Math.round((passedChecks / totalChecks) * 100);
      const canDeploy = failedCritical === 0;

      setReadiness({
        score,
        checks,
        canDeploy
      });

    } catch (error) {
      console.error('Production readiness check failed:', error);
      toast.error('Failed to perform readiness checks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performChecks();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'bg-green-100 text-green-800';
      case 'fail':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!readiness) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            Production Readiness Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            {loading ? 'Performing checks...' : 'Loading...'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Production Readiness</span>
          <Button
            variant="outline"
            size="sm"
            onClick={performChecks}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="text-center">
            <div className="text-3xl font-bold mb-2">{readiness.score}%</div>
            <Progress value={readiness.score} className="w-full" />
            <div className="mt-2">
              <Badge 
                variant={readiness.canDeploy ? "default" : "destructive"}
                className="text-sm"
              >
                {readiness.canDeploy ? 'Ready for Production' : 'Not Ready for Production'}
              </Badge>
            </div>
          </div>

          {/* Individual Checks */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              System Checks
            </h3>
            {readiness.checks.map((check, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <div className="font-medium">{check.name}</div>
                    <div className="text-sm text-muted-foreground">{check.message}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {check.critical && (
                    <Badge variant="secondary" className="text-xs">
                      Critical
                    </Badge>
                  )}
                  <Badge className={`text-xs ${getStatusColor(check.status)}`}>
                    {check.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Deployment Guidance */}
          {!readiness.canDeploy && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                <XCircle className="h-4 w-4" />
                Critical Issues Found
              </div>
              <p className="text-red-700 text-sm">
                Please resolve all critical failures before deploying to production. 
                These issues could prevent your application from functioning correctly.
              </p>
            </div>
          )}

          {readiness.canDeploy && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                <CheckCircle className="h-4 w-4" />
                Ready for Production
              </div>
              <p className="text-green-700 text-sm">
                Your application passes all critical checks and is ready for production deployment.
                Consider addressing any warnings for optimal performance.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};