import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Settings, 
  Shield, 
  Globe,
  Database,
  Webhook,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface ProductionCheck {
  essential_secrets: Record<string, boolean>;
  paystack_config: {
    is_valid: boolean;
    errors: string[];
    environment: 'test' | 'live';
    is_test_mode: boolean;
    has_webhook_secret: boolean;
    key_format_correct: boolean;
  };
  database_health: {
    config_exists: boolean;
    production_mode: boolean;
    error: string | null;
  };
  webhook_config: {
    endpoint_accessible: boolean;
    response_valid: boolean;
    error: string | null;
  };
  production_readiness: {
    is_ready: boolean;
    critical_issues: string[];
    warnings: string[];
    paystack_api_test: {
      success: boolean;
      error: string | null;
    };
    overall_score: number;
  };
}

interface ProductionStatusResponse {
  success: boolean;
  production_ready: boolean;
  environment_checks: ProductionCheck;
  recommendations: string[];
  next_steps: string[];
}

export const PaystackProductionStatus = () => {
  const [status, setStatus] = useState<ProductionStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runProductionCheck = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('production-environment-setup');
      
      if (error) {
        throw new Error(error.message);
      }
      
      setStatus(data);
      
      if (data.production_ready) {
        toast.success('Production environment is ready!');
      } else {
        toast.warning(`Production not ready: ${data.environment_checks.production_readiness.critical_issues.length} critical issues found`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check production status';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-600';
    if (score >= 70) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Paystack Production Readiness
              </CardTitle>
              <CardDescription>
                Comprehensive production environment validation and deployment readiness check
              </CardDescription>
            </div>
            <Button 
              onClick={runProductionCheck} 
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              {isLoading ? 'Checking...' : 'Run Production Check'}
            </Button>
          </div>
        </CardHeader>

        {error && (
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        )}

        {status && (
          <CardContent className="space-y-6">
            {/* Overall Status */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                {getStatusIcon(status.production_ready)}
                <div>
                  <h3 className="font-semibold">
                    Production Status: {status.production_ready ? 'READY' : 'NOT READY'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Readiness Score: {status.environment_checks.production_readiness.overall_score}%
                  </p>
                </div>
              </div>
              <Badge variant={status.production_ready ? 'default' : 'destructive'}>
                {status.production_ready ? 'GO-LIVE APPROVED' : 'BLOCKED'}
              </Badge>
            </div>

            {/* Score Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Production Readiness Score</span>
                <span className="font-medium">{status.environment_checks.production_readiness.overall_score}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${getScoreColor(status.environment_checks.production_readiness.overall_score)}`}
                  style={{ width: `${status.environment_checks.production_readiness.overall_score}%` }}
                />
              </div>
            </div>

            <Separator />

            {/* Detailed Checks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Environment Secrets */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Environment Secrets
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(status.environment_checks.essential_secrets).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs">{key}</span>
                      {getStatusIcon(value)}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Paystack Configuration */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Paystack Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Valid Configuration</span>
                    {getStatusIcon(status.environment_checks.paystack_config.is_valid)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Environment</span>
                    <Badge variant={status.environment_checks.paystack_config.environment === 'live' ? 'default' : 'secondary'}>
                      {status.environment_checks.paystack_config.environment.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Webhook Secret</span>
                    {getStatusIcon(status.environment_checks.paystack_config.has_webhook_secret)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>API Test</span>
                    {getStatusIcon(status.environment_checks.production_readiness.paystack_api_test.success)}
                  </div>
                </CardContent>
              </Card>

              {/* Database Health */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Database Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Configuration Exists</span>
                    {getStatusIcon(status.environment_checks.database_health.config_exists)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Production Mode</span>
                    {getStatusIcon(status.environment_checks.database_health.production_mode)}
                  </div>
                </CardContent>
              </Card>

              {/* Webhook Configuration */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    Webhook Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Endpoint Accessible</span>
                    {getStatusIcon(status.environment_checks.webhook_config.endpoint_accessible)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Response Valid</span>
                    {getStatusIcon(status.environment_checks.webhook_config.response_valid)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Issues and Recommendations */}
            {(status.environment_checks.production_readiness.critical_issues.length > 0 || 
              status.environment_checks.production_readiness.warnings.length > 0) && (
              <>
                <Separator />
                
                {status.environment_checks.production_readiness.critical_issues.length > 0 && (
                  <Alert>
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">Critical Issues (Must Fix Before Production):</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {status.environment_checks.production_readiness.critical_issues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {status.environment_checks.production_readiness.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">Warnings:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {status.environment_checks.production_readiness.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Recommendations */}
            {status.recommendations.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium">Recommendations:</h4>
                  <ul className="space-y-2">
                    {status.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* Next Steps */}
            {status.next_steps.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium">Next Steps:</h4>
                  <ul className="space-y-2">
                    {status.next_steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5 flex-shrink-0" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* Quick Actions */}
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                asChild
              >
                <a 
                  href="https://dashboard.paystack.com/#/settings/developers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Paystack Dashboard
                </a>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('/PAYSTACK_PRODUCTION_CHECKLIST.md', '_blank')}
              >
                Production Checklist
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={runProductionCheck}
                disabled={isLoading}
              >
                Refresh Status
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};