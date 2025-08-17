import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { validatePaymentFlow, formatDiagnosticResults, type DiagnosticResult } from '@/utils/paymentDiagnostics';

interface PaymentSystemValidatorProps {
  className?: string;
}

export const PaymentSystemValidator: React.FC<PaymentSystemValidatorProps> = ({ className }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    try {
      const diagnosticResults = await validatePaymentFlow();
      setResults(diagnosticResults);
      setShowDetails(true);
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass':
        return <Badge variant="secondary" className="bg-green-50 text-green-700">Pass</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">Warning</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          Payment System Diagnostics
        </CardTitle>
        <CardDescription>
          Run comprehensive checks on the payment system health and configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics}
          disabled={isRunning}
          variant="outline"
          className="w-full"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4 mr-2" />
              Run System Check
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Diagnostic Results</h4>
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground">
                  {results.filter(r => r.status === 'pass').length} passed, 
                  {results.filter(r => r.status === 'warning').length} warnings, 
                  {results.filter(r => r.status === 'fail').length} failed
                </span>
              </div>
            </div>

            {showDetails && (
              <div className="space-y-3">
                {Object.entries(
                  results.reduce((acc, result) => {
                    if (!acc[result.category]) {
                      acc[result.category] = [];
                    }
                    acc[result.category].push(result);
                    return acc;
                  }, {} as Record<string, DiagnosticResult[]>)
                ).map(([category, checks]) => (
                  <div key={category} className="border rounded-lg p-3">
                    <h5 className="font-medium mb-2">{category}</h5>
                    <div className="space-y-2">
                      {checks.map((check, index) => (
                        <div key={index} className="flex items-start gap-3 text-sm">
                          {getStatusIcon(check.status)}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{check.check}</span>
                              {getStatusBadge(check.status)}
                            </div>
                            <p className="text-muted-foreground mt-1">{check.message}</p>
                            {check.details && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-muted-foreground">
                                  Show details
                                </summary>
                                <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto">
                                  {JSON.stringify(check.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};