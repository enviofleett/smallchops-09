import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/integrations/supabase/client'
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, TestTube, Activity } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface HealthReport {
  timestamp: string
  environment: string
  paystack_mode: string
  status: string
  metrics: {
    payment_status: any
    recent_payments_count: number
    recent_payments: any[]
    order_completion_rate: number
    total_orders_24h: number
    health_metrics: any[]
  }
  configuration: {
    has_live_keys: boolean
    webhook_url: string
    force_live_mode: boolean
  }
  errors: Record<string, string>
}

interface TestSummary {
  timestamp: string
  summary: {
    total_tests: number
    passed: number
    failed: number
    skipped: number
    success_rate: number
    total_duration_ms: number
  }
  results: Array<{
    test_name: string
    status: 'pass' | 'fail' | 'skip'
    message: string
    details?: any
    duration_ms?: number
  }>
  production_ready: boolean
  recommendations: string[]
}

export const PaystackProductionDashboard: React.FC = () => {
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null)
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)

  const fetchHealthReport = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('paystack-production-health')
      
      if (error) {
        toast({
          title: "Health Check Failed",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      setHealthReport(data)
      toast({
        title: "Health Check Complete",
        description: "Production health status updated",
      })
    } catch (error) {
      console.error('Health check error:', error)
      toast({
        title: "Health Check Error",
        description: "Failed to fetch health status",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const runTestSuite = async () => {
    setTestLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('paystack-live-test-suite')
      
      if (error) {
        toast({
          title: "Test Suite Failed",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      setTestSummary(data)
      toast({
        title: "Test Suite Complete",
        description: `${data.summary.passed}/${data.summary.total_tests} tests passed`,
        variant: data.summary.failed === 0 ? "default" : "destructive",
      })
    } catch (error) {
      console.error('Test suite error:', error)
      toast({
        title: "Test Suite Error",
        description: "Failed to run test suite",
        variant: "destructive",
      })
    } finally {
      setTestLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthReport()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>
      case 'fail':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'skip':
        return <Badge variant="secondary"><AlertTriangle className="w-3 h-3 mr-1" />Skipped</Badge>
      default:
        return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />Unknown</Badge>
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paystack Production Dashboard</h1>
          <p className="text-muted-foreground">Monitor live payment system health and performance</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchHealthReport} 
            disabled={loading}
            variant="outline"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh Health
          </Button>
          <Button 
            onClick={runTestSuite} 
            disabled={testLoading}
          >
            {testLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
            Run Tests
          </Button>
        </div>
      </div>

      {healthReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Environment</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{healthReport.environment}</div>
              <p className="text-xs text-muted-foreground">
                {healthReport.paystack_mode} mode
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthReport.metrics.payment_status?.success_rate || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Last 24 hours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthReport.metrics.payment_status?.total_payments || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {healthReport.metrics.payment_status?.successful_payments || 0} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Order Completion</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{healthReport.metrics.order_completion_rate}%</div>
              <p className="text-xs text-muted-foreground">
                {healthReport.metrics.total_orders_24h} orders today
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
            </CardTitle>
            <CardDescription>Current production system status</CardDescription>
          </CardHeader>
          <CardContent>
            {healthReport ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Overall Status</span>
                  {getStatusBadge(healthReport.status)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Live Keys</span>
                    {healthReport.configuration.has_live_keys ? 
                      <CheckCircle className="w-4 h-4 text-success" /> : 
                      <XCircle className="w-4 h-4 text-destructive" />
                    }
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Force Live Mode</span>
                    {healthReport.configuration.force_live_mode ? 
                      <CheckCircle className="w-4 h-4 text-success" /> : 
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                </div>

                {Object.entries(healthReport.errors).some(([_, error]) => error) && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        {Object.entries(healthReport.errors).map(([key, error]) => 
                          error && (
                            <div key={key} className="text-sm">
                              <strong>{key}:</strong> {error}
                            </div>
                          )
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                Click "Refresh Health" to check system status
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              Production Tests
            </CardTitle>
            <CardDescription>Comprehensive system validation results</CardDescription>
          </CardHeader>
          <CardContent>
            {testSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-success">{testSummary.summary.passed}</div>
                    <div className="text-xs text-muted-foreground">Passed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-destructive">{testSummary.summary.failed}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-muted-foreground">{testSummary.summary.skipped}</div>
                    <div className="text-xs text-muted-foreground">Skipped</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {testSummary.results.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-sm capitalize">
                        {result.test_name.replace(/_/g, ' ')}
                      </span>
                      {getStatusBadge(result.status)}
                    </div>
                  ))}
                </div>

                <Alert className={testSummary.production_ready ? "border-success" : "border-destructive"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">
                      {testSummary.production_ready ? "✅ Production Ready" : "❌ Issues Found"}
                    </div>
                    <ul className="text-sm space-y-1">
                      {testSummary.recommendations.map((rec, index) => (
                        <li key={index}>• {rec}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                Click "Run Tests" to validate system readiness
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Configuration Details */}
      {healthReport && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration Details</CardTitle>
            <CardDescription>Current production configuration settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Webhook Configuration</h4>
                  <p className="text-sm text-muted-foreground font-mono">
                    {healthReport.configuration.webhook_url}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Last Updated</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(healthReport.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Next Steps:</strong> Ensure your Paystack dashboard webhook is configured to: <br />
                  <code className="text-sm">{healthReport.configuration.webhook_url}</code>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}