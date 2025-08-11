import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  Play, 
  RefreshCw, 
  Bug, 
  Zap 
} from 'lucide-react';
import { runEmergencyPaymentTest, diagnosePaymentIssues, EmergencyTestResult } from '@/utils/emergencyPaymentTest';
import { toast } from 'sonner';

export const EmergencyPaymentDashboard: React.FC = () => {
  const [testResults, setTestResults] = useState<EmergencyTestResult[]>([]);
  const [diagnosis, setDiagnosis] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    try {
      toast.info('Running emergency payment tests...');
      
      const results = await runEmergencyPaymentTest();
      setTestResults(results);
      
      const issues = await diagnosePaymentIssues();
      setDiagnosis(issues);
      
      const failedTests = results.filter(r => !r.success);
      if (failedTests.length === 0) {
        toast.success('All tests passed! Payment flow is healthy.');
      } else {
        toast.error(`${failedTests.length} tests failed. Check results below.`);
      }
    } catch (err) {
      toast.error('Test suite failed to run');
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const getTestIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-red-600" />
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Emergency Payment Flow Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={runTests} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning ? 'Running Tests...' : 'Run Emergency Tests'}
            </Button>
          </div>

          {diagnosis.length > 0 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Quick Diagnosis:</div>
                <ul className="space-y-1">
                  {diagnosis.map((issue, idx) => (
                    <li key={idx} className="text-sm">
                      {issue.startsWith('✅') ? (
                        <span className="text-green-600">{issue}</span>
                      ) : (
                        <span className="text-orange-600">• {issue}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {testResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Test Results:</h4>
              {testResults.map((result, idx) => (
                <div 
                  key={idx} 
                  className={`border rounded-lg p-3 ${
                    result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTestIcon(result.success)}
                      <span className="font-medium">{result.step}</span>
                    </div>
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? 'PASS' : 'FAIL'}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                  
                  {result.error && (
                    <div className="mt-2 text-sm text-red-600 font-medium">
                      Error: {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Emergency Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              onClick={() => {
                window.open('/payment/callback?reference=test_txn_format', '_blank');
              }}
            >
              Test Payment Callback
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                const testRef = `txn_${Date.now()}_test`;
                console.log('Testing reference generation:', testRef);
                toast.info(`Generated test reference: ${testRef}`);
              }}
            >
              Test Reference Generation
            </Button>
          </div>
          
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Critical Fix Status:</strong> The backend is configured for txn_ format. 
              If tests show old format orders, the frontend deployment needs immediate attention.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};