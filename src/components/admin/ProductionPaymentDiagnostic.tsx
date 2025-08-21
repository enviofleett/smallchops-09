import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Play, 
  RefreshCw,
  Shield,
  CreditCard,
  Database,
  Wrench,
  TrendingUp,
  Clock
} from 'lucide-react';
import { 
  productionPaymentDiagnostic,
  runQuickProductionDiagnostic,
  runExtendedProductionDiagnostic,
  repairPaymentGaps,
  ProductionDiagnosticReport,
  PaymentRecordGap
} from '@/utils/productionPaymentDiagnostic';
import { toast } from 'sonner';

const ProductionPaymentDiagnostic: React.FC = () => {
  const [diagnosticReport, setDiagnosticReport] = useState<ProductionDiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [repairInProgress, setRepairInProgress] = useState(false);
  const [repairResults, setRepairResults] = useState<any>(null);

  const runQuickDiagnostic = async () => {
    setLoading(true);
    try {
      toast.info('Running quick production diagnostic (last 24 hours)...');
      const report = await runQuickProductionDiagnostic();
      setDiagnosticReport(report);
      
      if (report.critical_issues.length === 0) {
        toast.success('Production diagnostic completed - No critical issues found!');
      } else {
        toast.error(`Production diagnostic completed - ${report.critical_issues.length} critical issues found`);
      }
    } catch (error) {
      toast.error(`Diagnostic failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runExtendedDiagnostic = async () => {
    setLoading(true);
    try {
      toast.info('Running extended production diagnostic (last 72 hours)...');
      const report = await runExtendedProductionDiagnostic();
      setDiagnosticReport(report);
      
      if (report.critical_issues.length === 0) {
        toast.success('Extended diagnostic completed - No critical issues found!');
      } else {
        toast.error(`Extended diagnostic completed - ${report.critical_issues.length} critical issues found`);
      }
    } catch (error) {
      toast.error(`Extended diagnostic failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runRepairProcess = async () => {
    if (!diagnosticReport || diagnosticReport.gaps_found.length === 0) {
      toast.warning('No gaps found to repair');
      return;
    }

    setRepairInProgress(true);
    try {
      toast.info(`Attempting to repair ${diagnosticReport.gaps_found.length} payment record gaps...`);
      const results = await repairPaymentGaps(diagnosticReport.gaps_found);
      setRepairResults(results);
      
      if (results.failed === 0) {
        toast.success(`Successfully repaired ${results.repaired} payment records!`);
      } else {
        toast.warning(`Repaired ${results.repaired} records, ${results.failed} failed`);
      }

      // Re-run diagnostic to see updated status
      setTimeout(() => {
        runQuickDiagnostic();
      }, 2000);
    } catch (error) {
      toast.error(`Repair process failed: ${error.message}`);
    } finally {
      setRepairInProgress(false);
    }
  };

  const getEnvironmentBadge = (env: string) => {
    return env === 'production' 
      ? <Badge variant="destructive">🚨 PRODUCTION</Badge>
      : <Badge variant="secondary">🧪 Development</Badge>;
  };

  const getSeverityIcon = (severity: 'critical' | 'warning' | 'success') => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getHealthStatus = (report: ProductionDiagnosticReport) => {
    if (report.critical_issues.length > 0) return 'critical';
    if (report.gaps_found.length > 0 || !report.rpc_test_results.available) return 'warning';
    return 'success';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Production Payment Diagnostic
          </h2>
          <p className="text-muted-foreground">
            Comprehensive analysis of payment processing in production environment
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={runQuickDiagnostic} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Quick Scan (24h)
          </Button>
          <Button 
            onClick={runExtendedDiagnostic} 
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
            Extended Scan (72h)
          </Button>
        </div>
      </div>

      {diagnosticReport && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className={`border-l-4 ${getHealthStatus(diagnosticReport) === 'critical' ? 'border-l-red-500' : 
              getHealthStatus(diagnosticReport) === 'warning' ? 'border-l-yellow-500' : 'border-l-green-500'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">System Health</p>
                    <p className="text-2xl font-bold flex items-center gap-2">
                      {getSeverityIcon(getHealthStatus(diagnosticReport))}
                      {getHealthStatus(diagnosticReport).toUpperCase()}
                    </p>
                  </div>
                  {getEnvironmentBadge(diagnosticReport.environment)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Orders Scanned</p>
                    <p className="text-2xl font-bold">{diagnosticReport.summary.total_orders_scanned}</p>
                  </div>
                  <Database className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Missing Records</p>
                    <p className={`text-2xl font-bold ${diagnosticReport.summary.orders_missing_payment_records > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {diagnosticReport.summary.orders_missing_payment_records}
                    </p>
                  </div>
                  <CreditCard className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Critical Issues</p>
                    <p className={`text-2xl font-bold ${diagnosticReport.critical_issues.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {diagnosticReport.critical_issues.length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Orders with Payment Records</span>
                      <span>{diagnosticReport.summary.orders_with_payment_records}/{diagnosticReport.summary.total_orders_scanned}</span>
                    </div>
                    <Progress 
                      value={(diagnosticReport.summary.orders_with_payment_records / diagnosticReport.summary.total_orders_scanned) * 100} 
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Successful Orders</span>
                      <span>{diagnosticReport.summary.successful_orders}/{diagnosticReport.summary.total_orders_scanned}</span>
                    </div>
                    <Progress 
                      value={(diagnosticReport.summary.successful_orders / diagnosticReport.summary.total_orders_scanned) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>RPC Function Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Function Available</span>
                    {diagnosticReport.rpc_test_results.available ? (
                      <Badge variant="default">✅ Available</Badge>
                    ) : (
                      <Badge variant="destructive">❌ Missing</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <Badge variant={diagnosticReport.rpc_test_results.status === 'functional' ? 'default' : 'destructive'}>
                      {diagnosticReport.rpc_test_results.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {diagnosticReport.rpc_test_results.message}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {diagnosticReport.critical_issues.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <strong className="text-red-800">Critical Issues Detected:</strong>
                <ul className="mt-2 space-y-1">
                  {diagnosticReport.critical_issues.map((issue, index) => (
                    <li key={index} className="text-red-700">• {issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="gaps" className="space-y-4">
            <TabsList>
              <TabsTrigger value="gaps">Payment Gaps ({diagnosticReport.gaps_found.length})</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              <TabsTrigger value="repair">Auto-Repair</TabsTrigger>
              <TabsTrigger value="details">Technical Details</TabsTrigger>
            </TabsList>

            <TabsContent value="gaps" className="space-y-4">
              {diagnosticReport.gaps_found.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Orders Missing Payment Transaction Records</h3>
                    <Button 
                      onClick={runRepairProcess}
                      disabled={repairInProgress}
                      className="flex items-center gap-2"
                    >
                      {repairInProgress ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                      Auto-Repair All
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {diagnosticReport.gaps_found.map((gap, index) => (
                      <Card key={index} className="border-orange-200">
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm font-medium">Order</p>
                              <p className="text-sm text-muted-foreground">{gap.order_number}</p>
                              <p className="text-xs text-muted-foreground">{gap.order_id}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Payment Reference</p>
                              <p className="text-sm text-muted-foreground font-mono">{gap.payment_reference}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Status</p>
                              <div className="flex gap-2">
                                <Badge variant={gap.order_status === 'confirmed' ? 'default' : 'secondary'}>
                                  {gap.order_status}
                                </Badge>
                                <Badge variant={gap.payment_status === 'paid' ? 'default' : 'secondary'}>
                                  {gap.payment_status}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Amount</p>
                              <p className="text-sm text-muted-foreground">₦{gap.total_amount.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{formatTimestamp(gap.created_at)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Payment Gaps Found</h3>
                      <p className="text-muted-foreground">
                        All orders have proper payment transaction records
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {diagnosticReport.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="text-sm mt-1">•</span>
                        <span className="text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="repair" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Automated Repair Process</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      The auto-repair process will use the RPC function to create missing payment transaction records 
                      for orders that were successfully paid but lack proper database entries.
                    </AlertDescription>
                  </Alert>
                  
                  {repairResults && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4">
                        <h4 className="font-semibold mb-2">Repair Results</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-green-600">{repairResults.repaired}</p>
                            <p className="text-sm text-muted-foreground">Repaired</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-red-600">{repairResults.failed}</p>
                            <p className="text-sm text-muted-foreground">Failed</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{repairResults.repaired + repairResults.failed}</p>
                            <p className="text-sm text-muted-foreground">Total</p>
                          </div>
                        </div>
                        {repairResults.errors.length > 0 && (
                          <div className="mt-4">
                            <h5 className="font-medium mb-2">Errors:</h5>
                            <ul className="text-sm space-y-1">
                              {repairResults.errors.map((error, index) => (
                                <li key={index} className="text-red-600">• {error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  
                  <div className="flex gap-3">
                    <Button 
                      onClick={runRepairProcess}
                      disabled={repairInProgress || !diagnosticReport.gaps_found.length}
                      className="flex items-center gap-2"
                    >
                      {repairInProgress ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                      Start Repair Process
                    </Button>
                    <Button 
                      onClick={runQuickDiagnostic}
                      disabled={loading}
                      variant="outline"
                    >
                      Re-scan After Repair
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Technical Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Scan Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Timestamp: {formatTimestamp(diagnosticReport.scan_timestamp)}</div>
                        <div>Environment: {diagnosticReport.environment}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">RPC Test Results</h4>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                        {JSON.stringify(diagnosticReport.rpc_test_results, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!diagnosticReport && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Shield className="h-20 w-20 mx-auto text-muted-foreground mb-6" />
              <h3 className="text-xl font-semibold mb-2">Production Payment Diagnostic</h3>
              <p className="text-muted-foreground mb-6">
                Run a comprehensive diagnostic to ensure all successful orders have proper payment transaction records
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={runQuickDiagnostic} disabled={loading}>
                  <Clock className="h-4 w-4 mr-2" />
                  Quick Scan (24 hours)
                </Button>
                <Button onClick={runExtendedDiagnostic} disabled={loading} variant="outline">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Extended Scan (72 hours)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProductionPaymentDiagnostic;
