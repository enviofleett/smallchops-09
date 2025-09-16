import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { CheckoutErrorAuditor, CheckoutAuditReport } from '@/utils/checkoutErrorAuditor';
import { AlertCircle, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

export const CheckoutErrorAuditorComponent: React.FC = () => {
  const [auditReport, setAuditReport] = useState<CheckoutAuditReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [formattedReport, setFormattedReport] = useState<string>('');

  const runAudit = async () => {
    setIsRunning(true);
    try {
      const report = await CheckoutErrorAuditor.runComprehensiveAudit();
      setAuditReport(report);
      setFormattedReport(CheckoutErrorAuditor.formatAuditReport(report));
    } catch (error) {
      console.error('Audit failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'DEGRADED': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'CRITICAL': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'secondary';
      case 'MEDIUM': return 'outline';
      case 'HIGH': return 'destructive';
      case 'CRITICAL': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6" />
            Checkout Error Auditor
          </CardTitle>
          <CardDescription>
            Comprehensive audit of checkout system errors and connectivity issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runAudit} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running Audit...
              </>
            ) : (
              'Run Checkout Audit'
            )}
          </Button>
        </CardContent>
      </Card>

      {auditReport && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(auditReport.overallStatus)}
                System Status: {auditReport.overallStatus}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {auditReport.summary.totalErrors}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Errors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {auditReport.summary.criticalErrors}
                  </div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {auditReport.summary.networkIssues}
                  </div>
                  <div className="text-sm text-muted-foreground">Network Issues</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {auditReport.summary.edgeFunctionIssues}
                  </div>
                  <div className="text-sm text-muted-foreground">Edge Function Issues</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {auditReport.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detected Errors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {auditReport.errors.map((error, index) => (
                  <Alert key={index} variant={error.severity === 'CRITICAL' || error.severity === 'HIGH' ? 'destructive' : 'default'}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="flex items-center gap-2">
                      {error.errorType} Error
                      <Badge variant={getSeverityColor(error.severity) as any}>
                        {error.severity}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      <div className="space-y-2">
                        <p><strong>Description:</strong> {error.description}</p>
                        <p><strong>Recommendation:</strong> {error.recommendation}</p>
                        <p><strong>Can Retry:</strong> {error.canRetry ? 'Yes' : 'No'}</p>
                        <p className="text-xs text-muted-foreground">
                          <strong>Timestamp:</strong> {new Date(error.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {auditReport.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {auditReport.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary font-semibold">{index + 1}.</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Full Report</CardTitle>
              <CardDescription>
                Detailed audit report for technical analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formattedReport}
                readOnly
                className="font-mono text-xs h-64"
                placeholder="Audit report will appear here..."
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};