import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Users, CreditCard, Settings, Shield } from 'lucide-react';
import { validateGuestCheckoutProduction, getGuestCheckoutReadinessReport } from '@/utils/guestCheckoutProductionValidator';
import { toast } from '@/hooks/use-toast';

interface GuestCheckoutStatusProps {
  className?: string;
}

export const GuestCheckoutStatus: React.FC<GuestCheckoutStatusProps> = ({ className }) => {
  const [validation, setValidation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string>('');

  const runValidation = async () => {
    setIsLoading(true);
    try {
      const result = await validateGuestCheckoutProduction();
      const reportText = await getGuestCheckoutReadinessReport();
      
      setValidation(result);
      setReport(reportText);
      
      toast({
        title: result.isReady ? "Guest Checkout Ready" : "Issues Found",
        description: result.isReady 
          ? "Your guest checkout is production-ready!" 
          : `Found ${result.issues.length} critical issues`,
        variant: result.isReady ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        title: "Validation Failed",
        description: "Could not check guest checkout status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runValidation();
  }, []);

  const getStatusColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (isReady: boolean, score: number) => {
    if (isReady) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (score >= 50) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Guest Checkout Status
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runValidation}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {validation ? (
          <>
            {/* Overall Status */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(validation.isReady, validation.score)}
                <div>
                  <div className="font-semibold">
                    {validation.isReady ? 'Production Ready' : 'Needs Attention'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Score: {validation.score}/100
                  </div>
                </div>
              </div>
              <Badge variant={validation.isReady ? 'default' : 'destructive'}>
                {validation.isReady ? 'LIVE READY' : 'NOT READY'}
              </Badge>
            </div>

            {/* Component Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Users className="w-4 h-4" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Guest Sessions</div>
                  <div className="text-xs text-muted-foreground">User session management</div>
                </div>
                {validation.guestSessionSupport ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CreditCard className="w-4 h-4" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Payment System</div>
                  <div className="text-xs text-muted-foreground">Paystack integration</div>
                </div>
                {validation.paymentIntegrationReady ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Settings className="w-4 h-4" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Business Settings</div>
                  <div className="text-xs text-muted-foreground">Guest checkout enabled</div>
                </div>
                {validation.businessSettingsConfigured ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Shield className="w-4 h-4" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Security</div>
                  <div className="text-xs text-muted-foreground">Data protection</div>
                </div>
                {validation.issues.some(issue => issue.includes('security')) ? (
                  <XCircle className="w-4 h-4 text-red-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
              </div>
            </div>

            {/* Issues & Warnings */}
            {validation.issues.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-red-600">Critical Issues:</div>
                <div className="space-y-1">
                  {validation.issues.map((issue: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <XCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-yellow-600">Warnings:</div>
                <div className="space-y-1">
                  {validation.warnings.map((warning: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-3 h-3 text-yellow-600 flex-shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success Message */}
            {validation.isReady && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Production Ready!</span>
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Your guest checkout is fully configured and ready for live customers.
                </div>
              </div>
            )}

            {/* Detailed Report */}
            {report && (
              <details className="border rounded-lg">
                <summary className="p-3 cursor-pointer hover:bg-muted/50">
                  View Detailed Report
                </summary>
                <div className="p-3 border-t">
                  <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto">
                    {report}
                  </pre>
                </div>
              </details>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};