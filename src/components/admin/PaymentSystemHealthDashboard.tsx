import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Play, 
  RefreshCw,
  Clock,
  Database,
  Server,
  Shield,
  CreditCard
} from 'lucide-react';
import { 
  paymentSystemTester, 
  PaymentSystemHealthReport, 
  PaymentTestResult, 
  PaymentTests 
} from '@/utils/paymentSystemTesting';
import { toast } from 'sonner';

const PaymentSystemHealthDashboard: React.FC = () => {
  const [healthReport, setHealthReport] = useState<PaymentSystemHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningTest, setRunningTest] = useState<string | null>(null);

  const runFullHealthCheck = async () => {
    setLoading(true);
    try {
      toast.info('Running comprehensive payment system health check...');
      const report = await paymentSystemTester.runFullSystemHealthCheck();
      setHealthReport(report);
      
      if (report.overall_status === 'healthy') {
        toast.success('Payment system health check completed - All systems operational!');
      } else if (report.overall_status === 'degraded') {
        toast.warning('Payment system health check completed - Some issues detected');
      } else {
        toast.error('Payment system health check completed - Critical issues found');
      }
    } catch (error) {
      toast.error(`Health check failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runIndividualTest = async (testName: string, testFunction: () => Promise<PaymentTestResult>) => {
    setRunningTest(testName);
    try {
      const result = await testFunction();
      
      if (result.status === 'passed') {
        toast.success(`${testName} test passed`);
      } else if (result.status === 'warning') {
        toast.warning(`${testName} test completed with warnings`);
      } else {
        toast.error(`${testName} test failed: ${result.message}`);
      }
      
      return result;
    } catch (error) {
      toast.error(`${testName} test error: ${error.message}`);
    } finally {
      setRunningTest(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'failed':
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'passed':
      case 'healthy':
        return 'default'; // Green
      case 'warning':
      case 'degraded':
        return 'secondary'; // Yellow
      case 'failed':
      case 'critical':
        return 'destructive'; // Red
      default:
        return 'outline';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const getTestIcon = (testName: string) => {
    if (testName.includes('RPC') || testName.includes('Database')) return <Database className="h-4 w-4" />;
    if (testName.includes('Edge Function')) return <Server className="h-4 w-4" />;
    if (testName.includes('Security')) return <Shield className="h-4 w-4" />;
    return <CreditCard className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payment System Health Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and test critical payment system components
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={runFullHealthCheck} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Full Health Check
          </Button>
        </div>
      </div>

      {healthReport && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overall Status</p>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    {getStatusIcon(healthReport.overall_status)}
                    {healthReport.overall_status.toUpperCase()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tests Passed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {healthReport.tests_passed}/{healthReport.tests_run}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tests Failed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {healthReport.tests_failed}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Warnings</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {healthReport.tests_with_warnings}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="individual">Individual Tests</TabsTrigger>
          <TabsTrigger value="details">Detailed Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {healthReport ? (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Last health check completed at {new Date(healthReport.timestamp).toLocaleString()}
                  {' '}in {healthReport.environment} environment.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle>Test Results Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {healthReport.results.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTestIcon(result.test)}
                        <span className="font-medium">{result.test}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {formatDuration(result.duration)}
                        </span>
                        <Badge variant={getStatusBadgeVariant(result.status)}>
                          {result.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress 
                        value={(healthReport.tests_passed / healthReport.tests_run) * 100} 
                        className="h-2"
                      />
                      <p className="text-sm text-muted-foreground">
                        {Math.round((healthReport.tests_passed / healthReport.tests_run) * 100)}% of tests passed
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>System Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {healthReport.overall_status === 'healthy' && (
                        <p className="text-green-600">✅ All systems operational</p>
                      )}
                      {healthReport.tests_failed > 0 && (
                        <p className="text-red-600">❌ {healthReport.tests_failed} critical issues need attention</p>
                      )}
                      {healthReport.tests_with_warnings > 0 && (
                        <p className="text-yellow-600">⚠️ {healthReport.tests_with_warnings} warnings to review</p>
                      )}
                      <p className="text-muted-foreground">
                        Run individual tests for detailed diagnostics
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Health Check Data</h3>
                  <p className="text-muted-foreground mb-4">
                    Run a health check to see payment system status
                  </p>
                  <Button onClick={runFullHealthCheck} disabled={loading}>
                    Run Health Check
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Tests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => runIndividualTest('RPC Function Check', PaymentTests.rpcFunction)}
                  disabled={runningTest === 'RPC Function Check'}
                >
                  {runningTest === 'RPC Function Check' && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  Test RPC Functions
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => runIndividualTest('Transaction Creation', PaymentTests.transactionCreation)}
                  disabled={runningTest === 'Transaction Creation'}
                >
                  {runningTest === 'Transaction Creation' && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  Test Transaction Creation
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => runIndividualTest('Security Table', PaymentTests.securityTable)}
                  disabled={runningTest === 'Security Table'}
                >
                  {runningTest === 'Security Table' && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  Test Security Incidents
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Tests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => runIndividualTest('Verification Flow', PaymentTests.verificationFlow)}
                  disabled={runningTest === 'Verification Flow'}
                >
                  {runningTest === 'Verification Flow' && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  Test Payment Verification
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => runIndividualTest('Amount Validation', PaymentTests.amountValidation)}
                  disabled={runningTest === 'Amount Validation'}
                >
                  {runningTest === 'Amount Validation' && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  Test Amount Validation
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => runIndividualTest('Edge Functions', PaymentTests.edgeFunctions)}
                  disabled={runningTest === 'Edge Functions'}
                >
                  {runningTest === 'Edge Functions' && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  Test Edge Functions
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {healthReport ? (
            <div className="space-y-4">
              {healthReport.results.map((result, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {getTestIcon(result.test)}
                        {result.test}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {formatDuration(result.duration)}
                        </span>
                        <Badge variant={getStatusBadgeVariant(result.status)}>
                          {result.status}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{result.message}</p>
                      {result.data && (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-medium">View Test Data</summary>
                          <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No detailed results available. Run a health check to see test details.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentSystemHealthDashboard;
