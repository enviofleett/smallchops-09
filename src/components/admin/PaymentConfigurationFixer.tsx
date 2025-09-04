import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertTriangle, XCircle, RefreshCw, Settings, Key } from 'lucide-react';
import { diagnosePaystackConfiguration, quickPaystackDiagnostic, autoFixPaystackConfig } from '@/utils/paystackConfigDiagnostic';
import type { ConfigDiagnostic } from '@/utils/paystackConfigDiagnostic';

const PaymentConfigurationFixer = () => {
  const [diagnostic, setDiagnostic] = useState<ConfigDiagnostic | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [quickIssues, setQuickIssues] = useState<string[]>([]);
  const { toast } = useToast();

  const runDiagnostic = async () => {
    setIsRunning(true);
    try {
      console.log('🔍 Running payment configuration diagnostic...');
      
      // Run quick diagnostic first
      const issues = await quickPaystackDiagnostic();
      setQuickIssues(issues);
      
      // Run full diagnostic
      const result = await diagnosePaystackConfiguration();
      setDiagnostic(result);
      
      if (result.overall_status === 'healthy') {
        toast({
          title: "Configuration Healthy",
          description: "Payment system is properly configured.",
        });
      } else {
        toast({
          title: "Configuration Issues Found",
          description: `Found ${result.issues_found.length} issues that need attention.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Diagnostic failed:', error);
      toast({
        title: "Diagnostic Failed",
        description: `Error running diagnostic: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const attemptAutoFix = async () => {
    setIsFixing(true);
    try {
      const result = await autoFixPaystackConfig();
      
      if (result.fixed.length > 0) {
        toast({
          title: "Issues Fixed",
          description: `Auto-fixed ${result.fixed.length} issues.`,
        });
      }
      
      if (result.stillBroken.length > 0) {
        toast({
          title: "Manual Action Required",
          description: `${result.stillBroken.length} issues require manual intervention.`,
          variant: "destructive"
        });
      }
      
      // Re-run diagnostic after fix attempt
      await runDiagnostic();
    } catch (error) {
      toast({
        title: "Auto-fix Failed",
        description: `Error attempting fixes: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsFixing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail':
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return 'default' as const;
      case 'warning':
        return 'secondary' as const;
      case 'fail':
      case 'critical':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  // Auto-run diagnostic on component mount
  useEffect(() => {
    runDiagnostic();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Payment Configuration Diagnostic
          </CardTitle>
          <CardDescription>
            Diagnose and fix payment system configuration issues automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Issues Summary */}
          {quickIssues.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Critical Issues Detected:</div>
                <ul className="list-disc list-inside space-y-1">
                  {quickIssues.map((issue, index) => (
                    <li key={index} className="text-sm">{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Overall Status */}
          {diagnostic && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(diagnostic.overall_status)}
                <div>
                  <h3 className="font-semibold">
                    Overall Status: {diagnostic.overall_status?.toUpperCase() || 'UNKNOWN'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {diagnostic.issues_found.length === 0 
                      ? 'All systems operational' 
                      : `${diagnostic.issues_found.length} issues found`}
                  </p>
                </div>
              </div>
              <Badge variant={getStatusBadgeVariant(diagnostic.overall_status)}>
                {diagnostic.overall_status}
              </Badge>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostic} 
              disabled={isRunning || isFixing}
              variant="outline"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Diagnostic...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run Diagnostic
                </>
              )}
            </Button>
            
            {diagnostic && diagnostic.overall_status !== 'healthy' && (
              <Button 
                onClick={attemptAutoFix} 
                disabled={isRunning || isFixing}
                variant="default"
              >
                {isFixing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Attempting Fixes...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Auto-Fix Issues
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Detailed Test Results */}
          {diagnostic && diagnostic.tests.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold">Detailed Test Results:</h4>
              {diagnostic.tests.map((test, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  {getStatusIcon(test.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">{test.name}</h5>
                      <Badge variant={getStatusBadgeVariant(test.status)} className="text-xs">
                        {test.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{test.message}</p>
                    {test.recommendation && (
                      <p className="text-sm text-blue-600 mt-2">
                        💡 {test.recommendation}
                      </p>
                    )}
                    {test.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">
                          Show Details
                        </summary>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(test.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {diagnostic && diagnostic.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Recommendations:</h4>
              <div className="space-y-2">
                {diagnostic.recommendations.map((rec, index) => (
                  <Alert key={index}>
                    <Key className="h-4 w-4" />
                    <AlertDescription>{rec}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Manual Configuration Instructions */}
          {diagnostic && diagnostic.overall_status === 'critical' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Manual Configuration Required:</div>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Go to Supabase Dashboard → Project Settings → Edge Functions</li>
                  <li>Add environment variable: <code className="bg-muted px-1 rounded">PAYSTACK_SECRET_KEY</code></li>
                  <li>Set value to your Paystack secret key (sk_test_... or sk_live_...)</li>
                  <li>Save and redeploy functions</li>
                  <li>Run diagnostic again to verify</li>
                </ol>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentConfigurationFixer;
