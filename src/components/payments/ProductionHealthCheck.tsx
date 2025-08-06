import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Settings, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProductionReadiness {
  ready_for_production: boolean;
  score: number;
  webhook_secret_configured: boolean;
  live_keys_configured: boolean;
  webhook_url_configured: boolean;
  issues: string[];
  last_checked: string;
}

interface PaymentConfig {
  public_key: string;
  test_mode: boolean;
  secret_key: string;
  webhook_secret: string;
  environment: string;
}

export const ProductionHealthCheck: React.FC = () => {
  const [readiness, setReadiness] = useState<ProductionReadiness | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkProductionReadiness();
  }, []);

  const checkProductionReadiness = async () => {
    try {
      setChecking(true);
      setError(null);

      // Check production readiness
      const { data: readinessData, error: readinessError } = await supabase
        .rpc('check_production_readiness');

      if (readinessError) throw readinessError;

      // Get current Paystack configuration
      const { data: configData, error: configError } = await supabase
        .rpc('get_active_paystack_config');

      if (configError) {
        console.warn('Could not get Paystack config:', configError);
      }

      setReadiness(readinessData as unknown as ProductionReadiness);
      setPaymentConfig(configData?.[0] || null);
    } catch (err) {
      console.error('Failed to check production readiness:', err);
      setError(err instanceof Error ? err.message : 'Failed to check system status');
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  const getStatusColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (ready: boolean, score: number) => {
    if (ready) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (score >= 60) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Checking Production Readiness...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Health Check Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={checkProductionReadiness} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Check
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!readiness) return null;

  return (
    <div className="space-y-6 w-full max-w-4xl">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(readiness.ready_for_production, readiness.score)}
              Production Readiness
            </div>
            <Badge variant={readiness.ready_for_production ? 'default' : 'destructive'}>
              {readiness.ready_for_production ? 'Ready' : 'Not Ready'}
            </Badge>
          </CardTitle>
          <CardDescription>
            System score: <span className={getStatusColor(readiness.score)}>{readiness.score}/100</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  readiness.score >= 80 ? 'bg-green-600' : 
                  readiness.score >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                }`}
                style={{ width: `${readiness.score}%` }}
              />
            </div>
            
            {readiness.ready_for_production ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your payment system is ready for production! All critical components are properly configured.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your system needs attention before going live. Please address the issues below.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Status */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Webhook Secret</span>
              <Badge variant={readiness.webhook_secret_configured ? 'default' : 'destructive'}>
                {readiness.webhook_secret_configured ? 'Configured' : 'Missing'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Live API Keys</span>
              <Badge variant={readiness.live_keys_configured ? 'default' : 'destructive'}>
                {readiness.live_keys_configured ? 'Configured' : 'Missing'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Webhook URL</span>
              <Badge variant={readiness.webhook_url_configured ? 'default' : 'destructive'}>
                {readiness.webhook_url_configured ? 'Configured' : 'Missing'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Environment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentConfig ? (
              <>
                <div className="flex items-center justify-between">
                  <span>Environment</span>
                  <Badge variant={paymentConfig.test_mode ? 'secondary' : 'default'}>
                    {paymentConfig.environment.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Public Key</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {paymentConfig.public_key.substring(0, 20)}...
                  </code>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Test Mode</span>
                  <Badge variant={paymentConfig.test_mode ? 'secondary' : 'default'}>
                    {paymentConfig.test_mode ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>No payment configuration found</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Issues */}
      {readiness.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-600">Issues to Resolve</CardTitle>
            <CardDescription>
              Address these issues before deploying to production
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {readiness.issues.map((issue, index) => (
                <li key={index} className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{issue}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button 
            onClick={checkProductionReadiness} 
            disabled={checking}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
          
          <Button asChild variant="outline">
            <a 
              href="https://dashboard.paystack.com/#/settings/developer" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Paystack Dashboard
            </a>
          </Button>
          
          <Button asChild variant="outline">
            <a 
              href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/functions" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Settings className="h-4 w-4 mr-2" />
              Edge Functions
            </a>
          </Button>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Last checked: {new Date(readiness.last_checked).toLocaleString()}
      </div>
    </div>
  );
};