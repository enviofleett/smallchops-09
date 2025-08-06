import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
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

export const ProductionHealthCheck: React.FC = () => {
  const [healthData, setHealthData] = useState<ProductionReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkProductionReadiness = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('check_production_readiness');
      
      if (error) {
        throw new Error(error.message);
      }
      
      setHealthData(data as unknown as ProductionReadiness);
    } catch (err) {
      console.error('Production readiness check failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to check production readiness');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkProductionReadiness();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>Production Health Check</CardTitle>
        </div>
        <CardDescription>
          Verify your payment system is ready for live deployment
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">System Status</h3>
          <Button
            onClick={checkProductionReadiness}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Checking...' : 'Refresh'}
          </Button>
        </div>

        {healthData && (
          <div className="space-y-4">
            {/* Overall Status */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {healthData.ready_for_production ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                <div>
                  <p className="font-medium">
                    {healthData.ready_for_production ? 'Ready for Production' : 'Not Ready for Production'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Production readiness score
                  </p>
                </div>
              </div>
              <Badge variant={getScoreBadgeVariant(healthData.score)} className="text-lg px-3 py-1">
                {healthData.score}/100
              </Badge>
            </div>

            {/* Configuration Checklist */}
            <div className="space-y-3">
              <h4 className="font-semibold">Configuration Checklist</h4>
              
              <div className="grid gap-2">
                <div className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">Webhook Secret Configured</span>
                  {healthData.webhook_secret_configured ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                
                <div className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">Live API Keys Configured</span>
                  {healthData.live_keys_configured ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                
                <div className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">Webhook URL Configured</span>
                  {healthData.webhook_url_configured ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            </div>

            {/* Issues */}
            {healthData.issues.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-red-600">Issues to Resolve</h4>
                <div className="space-y-2">
                  {healthData.issues.map((issue, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{issue}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* Production Tips */}
            {!healthData.ready_for_production && (
              <div className="space-y-3">
                <h4 className="font-semibold">Next Steps for Production</h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="font-medium">1. Configure Webhook Secret</p>
                    <p className="text-muted-foreground">
                      Set your Paystack webhook secret in payment integrations settings
                    </p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="font-medium">2. Add Live API Keys</p>
                    <p className="text-muted-foreground">
                      Replace test keys with live Paystack API keys for production
                    </p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="font-medium">3. Configure Webhooks in Paystack</p>
                    <p className="text-muted-foreground">
                      Set webhook URL in your Paystack dashboard to receive payment events
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {healthData.ready_for_production && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  🎉 Your payment system is ready for production! All security checks passed.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground">
              Last checked: {new Date(healthData.last_checked).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};