import React, { useState, useEffect } from 'react';
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
  Wrench, 
  RefreshCw,
  Shield,
  CreditCard,
  Database,
  Play,
  Settings,
  TrendingUp
} from 'lucide-react';
import { 
  productionPaymentFixer,
  runComprehensiveProductionFix,
  fixMissingPaymentRecords,
  fixInconsistentOrderStatuses,
  testRPCFunction,
  getProductionHealth,
  FixResults,
  IndividualFixResult
} from '@/utils/productionPaymentFix';
import { toast } from 'sonner';

interface FixStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
}

const ProductionPaymentFixDashboard: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [fixResults, setFixResults] = useState<FixResults | null>(null);
  const [individualResults, setIndividualResults] = useState<{
    backfill?: IndividualFixResult;
    statusFix?: IndividualFixResult;
    rpcTest?: any;
  }>({});
  const [loading, setLoading] = useState(false);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [fixSteps, setFixSteps] = useState<FixStep[]>([]);

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const checkSystemHealth = async () => {
    try {
      const health = await getProductionHealth();
      setSystemHealth(health);
    } catch (error) {
      console.error('Failed to check system health:', error);
      toast.error('Failed to check system health');
    }
  };

  const updateFixStep = (stepId: string, status: FixStep['status'], message: string) => {
    setFixSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message } : step
    ));
  };

  const initializeFixSteps = () => {
    const steps: FixStep[] = [
      { id: 'rpc-test', title: 'Test RPC Function', status: 'pending', message: 'Testing RPC function availability' },
      { id: 'backfill', title: 'Backfill Records', status: 'pending', message: 'Creating missing payment transaction records' },
      { id: 'status-fix', title: 'Fix Statuses', status: 'pending', message: 'Correcting inconsistent order statuses' },
      { id: 'verification', title: 'Verify Fixes', status: 'pending', message: 'Verifying all fixes were applied correctly' }
    ];
    setFixSteps(steps);
  };

  const runComprehensiveFix = async () => {
    setLoading(true);
    setActiveOperation('comprehensive');
    initializeFixSteps();
    
    try {
      toast.info('🚨 Starting comprehensive payment system fix...');

      // Step 1: Test RPC Function
      updateFixStep('rpc-test', 'running', 'Testing RPC function availability');
      const rpcTest = await testRPCFunction();
      
      if (!rpcTest.available) {
        updateFixStep('rpc-test', 'error', 'RPC function not available');
        toast.error('Cannot proceed - RPC function not available');
        return;
      }
      updateFixStep('rpc-test', 'success', 'RPC function is available and functional');

      // Step 2: Run comprehensive fix
      updateFixStep('backfill', 'running', 'Running comprehensive fix');
      updateFixStep('status-fix', 'running', 'Processing all fixes');
      
      const results = await runComprehensiveProductionFix();
      setFixResults(results);

      if (results.success) {
        updateFixStep('backfill', 'success', `Processed ${results.backfill_results.processed_orders} records`);
        updateFixStep('status-fix', 'success', `Fixed ${results.status_fix_results.fixed_orders} statuses`);
        
        // Step 3: Verify fixes
        updateFixStep('verification', 'running', 'Verifying fixes and checking system health');
        await checkSystemHealth();
        updateFixStep('verification', 'success', 'System health verification completed');
        
        toast.success('🎉 Comprehensive fix completed successfully!');
      } else {
        updateFixStep('backfill', 'error', 'Fix process failed');
        updateFixStep('status-fix', 'error', 'Fix process failed');
        toast.error('Comprehensive fix failed');
      }
    } catch (error) {
      toast.error(`Comprehensive fix failed: ${error.message}`);
      updateFixStep('backfill', 'error', error.message);
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  const runIndividualFix = async (type: 'backfill' | 'statusFix' | 'rpcTest') => {
    setLoading(true);
    setActiveOperation(type);
    
    try {
      let result;
      let successMessage;
      
      switch (type) {
        case 'backfill':
          toast.info('Creating missing payment transaction records...');
          result = await fixMissingPaymentRecords();
          successMessage = `Backfill completed: ${result.processed_orders} records created`;
          break;
          
        case 'statusFix':
          toast.info('Fixing inconsistent order statuses...');
          result = await fixInconsistentOrderStatuses();
          successMessage = `Status fix completed: ${result.fixed_orders} orders fixed`;
          break;
          
        case 'rpcTest':
          toast.info('Testing RPC function...');
          result = await testRPCFunction();
          successMessage = result.available ? 'RPC function is working correctly' : 'RPC function has issues';
          break;
      }
      
      setIndividualResults(prev => ({ ...prev, [type]: result }));
      toast.success(successMessage);
      
      // Refresh system health after any fix
      await checkSystemHealth();
    } catch (error) {
      toast.error(`${type} operation failed: ${error.message}`);
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <RefreshCw className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStepIcon = (status: FixStep['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3 text-red-600">
            <Shield className="h-8 w-8" />
            Production Payment System Fix
          </h2>
          <p className="text-muted-foreground">
            Emergency repair tool for critical payment system issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={checkSystemHealth} 
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Health
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card className="border-2 border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Current System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {systemHealth ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  {getHealthIcon(systemHealth.overall_health)}
                  <span className="font-semibold">
                    Overall: {systemHealth.overall_health.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {systemHealth.rpc_function_status.available ? 
                    <CheckCircle className="h-5 w-5 text-green-500" /> : 
                    <XCircle className="h-5 w-5 text-red-500" />
                  }
                  <span>RPC: {systemHealth.rpc_function_status.available ? 'Available' : 'Missing'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <span>Orders (24h): {systemHealth.recent_orders_health.total_orders}</span>
                </div>
                <div className="flex items-center gap-2">
                  {systemHealth.issues_found.length === 0 ? 
                    <CheckCircle className="h-5 w-5 text-green-500" /> : 
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  }
                  <span>Issues: {systemHealth.issues_found.length}</span>
                </div>
              </div>
              
              {systemHealth.issues_found.length > 0 && (
                <Alert className="border-red-200">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Issues Found:</strong>
                    <ul className="mt-2 list-disc list-inside">
                      {systemHealth.issues_found.map((issue, index) => (
                        <li key={index} className="text-red-700">{issue}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Payment Record Consistency</span>
                  <span>{systemHealth.recent_orders_health.consistency_rate.toFixed(1)}%</span>
                </div>
                <Progress value={systemHealth.recent_orders_health.consistency_rate} className="h-2" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Checking system health...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Fix Controls */}
      <Card className="border-2 border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <Wrench className="h-5 w-5" />
            Emergency Fix Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <Button
              onClick={runComprehensiveFix}
              disabled={loading}
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-3"
            >
              {loading && activeOperation === 'comprehensive' ? (
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Shield className="h-5 w-5 mr-2" />
              )}
              RUN COMPREHENSIVE FIX
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              This will fix all payment issues: missing records, inconsistent statuses, and RPC problems
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => runIndividualFix('rpcTest')}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading && activeOperation === 'rpcTest' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Settings className="h-4 w-4" />
              )}
              Test RPC Function
            </Button>
            
            <Button
              onClick={() => runIndividualFix('backfill')}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading && activeOperation === 'backfill' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Fix Missing Records
            </Button>
            
            <Button
              onClick={() => runIndividualFix('statusFix')}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading && activeOperation === 'statusFix' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Fix Status Issues
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fix Progress */}
      {fixSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fix Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fixSteps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  {getStepIcon(step.status)}
                  <div className="flex-1">
                    <div className="font-medium">Step {index + 1}: {step.title}</div>
                    <div className="text-sm text-muted-foreground">{step.message}</div>
                  </div>
                  <Badge variant={
                    step.status === 'success' ? 'default' :
                    step.status === 'error' ? 'destructive' :
                    step.status === 'running' ? 'secondary' : 'outline'
                  }>
                    {step.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <Tabs defaultValue="comprehensive" className="space-y-4">
        <TabsList>
          <TabsTrigger value="comprehensive">Comprehensive Results</TabsTrigger>
          <TabsTrigger value="individual">Individual Results</TabsTrigger>
          <TabsTrigger value="health">Health Details</TabsTrigger>
        </TabsList>

        <TabsContent value="comprehensive" className="space-y-4">
          {fixResults ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Comprehensive Fix Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Payment Records Backfill</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Records Created:</span>
                        <Badge variant="default">{fixResults.backfill_results.processed_orders}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Errors:</span>
                        <Badge variant={fixResults.backfill_results.error_count > 0 ? 'destructive' : 'default'}>
                          {fixResults.backfill_results.error_count}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">Status Corrections</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Orders Fixed:</span>
                        <Badge variant="default">{fixResults.status_fix_results.fixed_orders}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Errors:</span>
                        <Badge variant={fixResults.status_fix_results.error_count > 0 ? 'destructive' : 'default'}>
                          {fixResults.status_fix_results.error_count}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                {(fixResults.backfill_results.errors.length > 0 || fixResults.status_fix_results.errors.length > 0) && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Errors:</h4>
                    <ul className="text-sm text-red-600 space-y-1">
                      {[...fixResults.backfill_results.errors, ...fixResults.status_fix_results.errors].map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Play className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Comprehensive Fix Results</h3>
                  <p className="text-muted-foreground mb-4">
                    Run the comprehensive fix to see detailed results
                  </p>
                  <Button onClick={runComprehensiveFix} disabled={loading}>
                    Run Comprehensive Fix
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(individualResults).map(([key, result]) => (
              result && (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      {key === 'backfill' ? 'Backfill Results' :
                       key === 'statusFix' ? 'Status Fix Results' :
                       'RPC Test Results'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          {systemHealth && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                  {JSON.stringify(systemHealth, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionPaymentFixDashboard;
