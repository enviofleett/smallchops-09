import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertTriangle, Play, RefreshCw } from 'lucide-react';
import { validateGuestCheckoutProduction } from '@/utils/guestCheckoutProductionValidator';
import { useGuestSession } from '@/hooks/useGuestSession';

export const GuestCheckoutValidator: React.FC = () => {
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const { guestSession, generateGuestSession } = useGuestSession();

  const runValidation = async () => {
    setIsRunning(true);
    try {
      const result = await validateGuestCheckoutProduction();
      setValidationResult(result);
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationResult({
        isReady: false,
        score: 0,
        issues: ['Validation test failed'],
        warnings: [],
        guestSessionSupport: false,
        paymentIntegrationReady: false,
        businessSettingsConfigured: false
      });
    } finally {
      setIsRunning(false);
    }
  };

  const testGuestSession = async () => {
    try {
      await generateGuestSession();
    } catch (error) {
      console.error('Guest session test failed:', error);
    }
  };

  useEffect(() => {
    runValidation();
  }, []);

  if (!validationResult) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="p-6 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Running guest checkout validation...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {validationResult.isReady ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
            Guest Checkout Production Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Production Readiness Score</span>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                validationResult.score >= 90 ? 'bg-green-100 text-green-800' :
                validationResult.score >= 70 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {validationResult.score}/100
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                {validationResult.guestSessionSupport ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm">Guest Sessions</span>
              </div>
              
              <div className="flex items-center gap-2">
                {validationResult.paymentIntegrationReady ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm">Payment System</span>
              </div>
              
              <div className="flex items-center gap-2">
                {validationResult.businessSettingsConfigured ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm">Business Config</span>
              </div>
            </div>

            {validationResult.isReady && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">🎉 GUEST CHECKOUT IS LIVE & PRODUCTION READY!</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Customers can now checkout without creating accounts. All systems are operational.
                </p>
              </div>
            )}

            {validationResult.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Issues
                </h4>
                <ul className="space-y-1">
                  {validationResult.issues.map((issue: string, i: number) => (
                    <li key={i} className="text-sm text-destructive pl-6">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </h4>
                <ul className="space-y-1">
                  {validationResult.warnings.map((warning: string, i: number) => (
                    <li key={i} className="text-sm text-amber-600 pl-6">• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button 
                onClick={runValidation} 
                disabled={isRunning}
                variant="outline"
                size="sm"
              >
                {isRunning ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Re-run Validation
              </Button>
              
              <Button 
                onClick={testGuestSession} 
                variant="outline"
                size="sm"
              >
                Test Guest Session
              </Button>
              
              {guestSession && (
                <div className="text-xs text-muted-foreground self-center">
                  Current guest session: {guestSession.sessionId.slice(0, 12)}...
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};