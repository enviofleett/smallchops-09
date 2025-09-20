// Phase 5.1: Comprehensive Testing Dashboard
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Users, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity
} from 'lucide-react';
import { 
  OrderTestingSuite, 
  TestScenario, 
  TestResults, 
  DEFAULT_TEST_SCENARIOS,
  ConcurrentTestConfig 
} from '@/utils/testingUtils';
import { useToast } from '@/hooks/use-toast';

export const TestingDashboard: React.FC = () => {
  const [scenarios, setScenarios] = useState<TestScenario[]>(DEFAULT_TEST_SCENARIOS);
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Map<string, TestResults>>(new Map());
  const [concurrentConfig, setConcurrentConfig] = useState<ConcurrentTestConfig>({
    adminCount: 3,
    operationsPerAdmin: 5,
    targetOrderId: '',
    delayBetweenOperations: 200
  });
  
  const { toast } = useToast();

  const getStatusIcon = (status: TestScenario['status']) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestScenario['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'passed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const updateScenarioStatus = (id: string, status: TestScenario['status'], results?: TestResults) => {
    setScenarios(prev => prev.map(scenario => 
      scenario.id === id 
        ? { 
            ...scenario, 
            status,
            results,
            startedAt: status === 'running' ? new Date().toISOString() : scenario.startedAt,
            completedAt: status !== 'running' ? new Date().toISOString() : undefined
          }
        : scenario
    ));

    if (results) {
      setTestResults(prev => new Map(prev).set(id, results));
    }
  };

  const runTest = async (scenarioId: string) => {
    if (runningTests.has(scenarioId)) return;

    setRunningTests(prev => new Set(prev).add(scenarioId));
    updateScenarioStatus(scenarioId, 'running');

    try {
      let results: TestResults;

      switch (scenarioId) {
        case 'concurrent_admins':
          results = await OrderTestingSuite.runConcurrentAdminTest(concurrentConfig);
          break;
        case 'order_lifecycle':
          results = await OrderTestingSuite.runOrderLifecycleTest();
          break;
        case 'stress_test':
          results = await OrderTestingSuite.runStressTest(30000); // 30 seconds
          break;
        case 'edge_cases':
          results = await OrderTestingSuite.runEdgeCaseTests();
          break;
        default:
          throw new Error(`Unknown test scenario: ${scenarioId}`);
      }

      updateScenarioStatus(scenarioId, results.success ? 'passed' : 'failed', results);
      
      toast({
        title: results.success ? 'Test Passed' : 'Test Failed',
        description: `${scenarioId} completed in ${results.duration}ms`,
        variant: results.success ? 'default' : 'destructive'
      });

    } catch (error) {
      updateScenarioStatus(scenarioId, 'failed');
      toast({
        title: 'Test Error',
        description: `Failed to run ${scenarioId}: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setRunningTests(prev => {
        const newSet = new Set(prev);
        newSet.delete(scenarioId);
        return newSet;
      });
    }
  };

  const runAllTests = async () => {
    for (const scenario of scenarios) {
      if (!runningTests.has(scenario.id)) {
        await runTest(scenario.id);
        // Add delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  };

  const stopAllTests = () => {
    OrderTestingSuite.stopAllTests();
    setRunningTests(new Set());
    setScenarios(prev => prev.map(scenario => 
      scenario.status === 'running' 
        ? { ...scenario, status: 'pending' }
        : scenario
    ));
  };

  const formatMetrics = (results: TestResults) => (
    <div className="grid grid-cols-2 gap-4 mt-4">
      <div className="text-sm">
        <span className="font-medium">Response Time:</span> {Math.round(results.metrics.responseTime)}ms
      </div>
      <div className="text-sm">
        <span className="font-medium">Throughput:</span> {results.metrics.throughput.toFixed(2)} ops/sec
      </div>
      <div className="text-sm">
        <span className="font-medium">Error Rate:</span> {(results.metrics.errorRate * 100).toFixed(1)}%
      </div>
      <div className="text-sm">
        <span className="font-medium">Conflict Rate:</span> {(results.metrics.conflictRate * 100).toFixed(1)}%
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Testing Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive testing suite for order management system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={runAllTests}
            disabled={runningTests.size > 0}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Run All Tests
          </Button>
          <Button
            variant="outline"
            onClick={stopAllTests}
            disabled={runningTests.size === 0}
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Stop All
          </Button>
        </div>
      </div>

      {/* Test Overview */}
      <div className="grid grid-cols-4 gap-4">
        {['pending', 'running', 'passed', 'failed'].map(status => (
          <Card key={status}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {getStatusIcon(status as TestScenario['status'])}
                <div>
                  <p className="text-2xl font-bold">
                    {scenarios.filter(s => s.status === status).length}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {status}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="scenarios" className="w-full">
        <TabsList>
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-4">
          {scenarios.map(scenario => (
            <Card key={scenario.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(scenario.status)}
                    <div>
                      <CardTitle className="text-lg">{scenario.name}</CardTitle>
                      <CardDescription>{scenario.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(scenario.status)}>
                      {scenario.status}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => runTest(scenario.id)}
                      disabled={runningTests.has(scenario.id)}
                      className="gap-2"
                    >
                      {runningTests.has(scenario.id) ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {runningTests.has(scenario.id) ? 'Running' : 'Run Test'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {scenario.results && (
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {scenario.results.operations} operations in {scenario.results.duration}ms
                    </span>
                    <Progress 
                      value={scenario.results.success ? 100 : 0} 
                      className="w-24"
                    />
                  </div>
                  
                  {formatMetrics(scenario.results)}
                  
                  {scenario.results.errors.length > 0 && (
                    <Alert className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-medium">Errors ({scenario.results.errors.length}):</div>
                        <ul className="list-disc list-inside text-sm mt-1">
                          {scenario.results.errors.slice(0, 3).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                          {scenario.results.errors.length > 3 && (
                            <li>...and {scenario.results.errors.length - 3} more</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Concurrent Admin Test Configuration</CardTitle>
              <CardDescription>
                Configure parameters for multi-admin concurrent testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adminCount">Number of Admins</Label>
                  <Input
                    id="adminCount"
                    type="number"
                    min="1"
                    max="10"
                    value={concurrentConfig.adminCount}
                    onChange={(e) => setConcurrentConfig(prev => ({
                      ...prev,
                      adminCount: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="operationsPerAdmin">Operations per Admin</Label>
                  <Input
                    id="operationsPerAdmin"
                    type="number"
                    min="1"
                    max="20"
                    value={concurrentConfig.operationsPerAdmin}
                    onChange={(e) => setConcurrentConfig(prev => ({
                      ...prev,
                      operationsPerAdmin: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="targetOrderId">Target Order ID (optional)</Label>
                <Input
                  id="targetOrderId"
                  placeholder="Leave empty to create test order"
                  value={concurrentConfig.targetOrderId}
                  onChange={(e) => setConcurrentConfig(prev => ({
                    ...prev,
                    targetOrderId: e.target.value
                  }))}
                />
              </div>
              
              <div>
                <Label htmlFor="delay">Delay Between Operations (ms)</Label>
                <Input
                  id="delay"
                  type="number"
                  min="0"
                  max="5000"
                  value={concurrentConfig.delayBetweenOperations}
                  onChange={(e) => setConcurrentConfig(prev => ({
                    ...prev,
                    delayBetweenOperations: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Test Results Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.size === 0 ? (
                <p className="text-muted-foreground">No test results yet. Run some tests to see results here.</p>
              ) : (
                <div className="space-y-4">
                  {Array.from(testResults.entries()).map(([scenarioId, results]) => {
                    const scenario = scenarios.find(s => s.id === scenarioId);
                    return (
                      <div key={scenarioId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium">{scenario?.name || scenarioId}</h3>
                          <Badge className={results.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {results.success ? 'PASSED' : 'FAILED'}
                          </Badge>
                        </div>
                        {formatMetrics(results)}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TestingDashboard;