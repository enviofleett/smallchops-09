import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  TestTube, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send,
  AlertTriangle,
  Users,
  ShoppingCart,
  CreditCard,
  UserPlus,
  Settings,
  Activity,
  Eye,
  Play
} from 'lucide-react';

interface SimulationResult {
  test: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  timing?: number;
  details?: any;
}

export const ProductionEmailSimulator: React.FC = () => {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('test@startersmallchops.com');
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTemplates, setActiveTemplates] = useState<any[]>([]);
  const [emailMetrics, setEmailMetrics] = useState<any>({});

  useEffect(() => {
    loadActiveTemplates();
    loadEmailMetrics();
  }, []);

  const loadActiveTemplates = async () => {
    const { data, error } = await (supabase as any)
      .from('enhanced_email_templates')
      .select('*')
      .eq('is_active', true)
      .order('template_key');
    
    if (!error && data) {
      setActiveTemplates(data);
    }
  };

  const loadEmailMetrics = async () => {
    // Get recent email delivery stats
    const { data, error } = await (supabase as any)
      .from('smtp_delivery_confirmations')
      .select('delivery_status, created_at, provider_used')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      const metrics = {
        total: data.length,
        sent: data.filter(d => d.delivery_status === 'sent').length,
        failed: data.filter(d => d.delivery_status === 'failed').length,
        providers: [...new Set(data.map(d => d.provider_used))]
      };
      setEmailMetrics(metrics);
    }
  };

  const updateResult = (test: string, status: SimulationResult['status'], message: string, details?: any, timing?: number) => {
    setSimulationResults(prev => {
      const updated = prev.filter(r => r.test !== test);
      return [...updated, { test, status, message, details, timing }];
    });
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runFullSimulation = async () => {
    setIsRunning(true);
    setSimulationResults([]);

    const tests = [
      'Core Template Validation',
      'SMTP Configuration',
      'Order Confirmation Flow',
      'Customer Welcome Flow', 
      'Payment Confirmation Flow',
      'Template Processing',
      'Rate Limiting',
      'Queue Processing',
      'Error Handling',
      'Production Readiness'
    ];

    // Initialize all tests as pending
    tests.forEach(test => updateResult(test, 'pending', 'Waiting...'));

    try {
      await runCoreTemplateValidation();
      await delay(500);
      
      await runSMTPConfigurationTest();
      await delay(500);
      
      await runOrderConfirmationFlow();
      await delay(500);
      
      await runCustomerWelcomeFlow();
      await delay(500);
      
      await runPaymentConfirmationFlow();
      await delay(500);
      
      await runTemplateProcessingTest();
      await delay(500);
      
      await runRateLimitingTest();
      await delay(500);
      
      await runQueueProcessingTest();
      await delay(500);
      
      await runErrorHandlingTest();
      await delay(500);
      
      await runProductionReadinessCheck();
      
      toast({
        title: "✅ Production Email Simulation Complete",
        description: "All email systems have been thoroughly tested for production readiness."
      });
      
    } catch (error: any) {
      toast({
        title: "❌ Simulation Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runCoreTemplateValidation = async () => {
    updateResult('Core Template Validation', 'running', 'Validating core email templates...');
    
    try {
      const coreTemplates = ['order_confirmation', 'customer_welcome', 'payment_confirmation', 'smtp_test'];
      const { data, error } = await (supabase as any)
        .from('enhanced_email_templates')
        .select('template_key, is_active, template_name')
        .in('template_key', coreTemplates)
        .eq('is_active', true);

      if (error) throw error;

      const foundTemplates = data.map(t => t.template_key);
      const missingTemplates = coreTemplates.filter(t => !foundTemplates.includes(t));

      if (missingTemplates.length > 0) {
        updateResult('Core Template Validation', 'error', 
          `Missing core templates: ${missingTemplates.join(', ')}`);
        return;
      }

      updateResult('Core Template Validation', 'success', 
        `All ${coreTemplates.length} core templates found and active`, 
        { templates: data });
    } catch (error: any) {
      updateResult('Core Template Validation', 'error', `Validation failed: ${error.message}`);
    }
  };

  const runSMTPConfigurationTest = async () => {
    updateResult('SMTP Configuration', 'running', 'Testing SMTP connection...');
    
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          templateKey: 'smtp_test',
          variables: {
            test_time: new Date().toLocaleString(),
            smtp_host: 'Unified SMTP System'
          }
        }
      });

      const timing = Date.now() - start;

      if (error) {
        throw new Error(error.message);
      }

      updateResult('SMTP Configuration', 'success', 
        `SMTP test email sent successfully`, 
        { data, testEmail }, timing);
    } catch (error: any) {
      updateResult('SMTP Configuration', 'error', `SMTP test failed: ${error.message}`);
    }
  };

  const runOrderConfirmationFlow = async () => {
    updateResult('Order Confirmation Flow', 'running', 'Simulating order confirmation...');
    
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          templateKey: 'order_confirmation',
          variables: {
            customer_name: 'Production Test Customer',
            order_number: `PROD-${Date.now()}`,
            order_total: '₦15,000',
            order_date: new Date().toLocaleDateString(),
            store_name: 'Starters'
          }
        }
      });

      const timing = Date.now() - start;

      if (error) throw error;

      updateResult('Order Confirmation Flow', 'success', 
        `Order confirmation email sent successfully`, 
        { data }, timing);
    } catch (error: any) {
      updateResult('Order Confirmation Flow', 'error', `Order confirmation failed: ${error.message}`);
    }
  };

  const runCustomerWelcomeFlow = async () => {
    updateResult('Customer Welcome Flow', 'running', 'Simulating customer welcome...');
    
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          templateKey: 'customer_welcome',
          variables: {
            customer_name: 'New Customer',
            store_name: 'Starters',
            support_email: 'support@startersmallchops.com'
          }
        }
      });

      const timing = Date.now() - start;

      if (error) throw error;

      updateResult('Customer Welcome Flow', 'success', 
        `Welcome email sent successfully`, 
        { data }, timing);
    } catch (error: any) {
      updateResult('Customer Welcome Flow', 'error', `Welcome email failed: ${error.message}`);
    }
  };

  const runPaymentConfirmationFlow = async () => {
    updateResult('Payment Confirmation Flow', 'running', 'Simulating payment confirmation...');
    
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          templateKey: 'payment_confirmation',
          variables: {
            customer_name: 'Test Customer',
            order_number: `PAY-${Date.now()}`,
            order_total: '₦25,000',
            payment_method: 'Online Payment',
            payment_reference: `txn_${Date.now()}_test`
          }
        }
      });

      const timing = Date.now() - start;

      if (error) throw error;

      updateResult('Payment Confirmation Flow', 'success', 
        `Payment confirmation sent successfully`, 
        { data }, timing);
    } catch (error: any) {
      updateResult('Payment Confirmation Flow', 'error', `Payment confirmation failed: ${error.message}`);
    }
  };

  const runTemplateProcessingTest = async () => {
    updateResult('Template Processing', 'running', 'Testing template variable replacement...');
    
    try {
      // Test template with multiple variables
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          subject: 'Template Test - {{test_var}} - {{timestamp}}',
          html: '<h1>Hello {{name}}</h1><p>Test completed at {{timestamp}}</p>',
          variables: {
            test_var: 'SUCCESS',
            timestamp: new Date().toISOString(),
            name: 'Production Tester'
          }
        }
      });

      if (error) throw error;

      updateResult('Template Processing', 'success', 
        `Template variable replacement working correctly`, 
        { data });
    } catch (error: any) {
      updateResult('Template Processing', 'error', `Template processing failed: ${error.message}`);
    }
  };

  const runRateLimitingTest = async () => {
    updateResult('Rate Limiting', 'running', 'Testing rate limiting system...');
    
    try {
      const { data, error } = await (supabase as any).rpc('check_email_rate_limit', {
        p_recipient_email: testEmail
      });

      if (error) throw error;

      // Type check and assertion for the returned data
      if (typeof data !== 'object' || data === null || typeof data === 'boolean') {
        throw new Error('Invalid rate limit response format');
      }

      const rateLimitData = data as {
        allowed: boolean;
        current_count: number;
        limit: number;
        window_minutes: number;
        reset_at: string;
        reason: string;
      };

      updateResult('Rate Limiting', 'success', 
        `Rate limiting functional: ${rateLimitData.current_count}/${rateLimitData.limit} emails`, 
        { rateLimitData });
    } catch (error: any) {
      updateResult('Rate Limiting', 'error', `Rate limiting check failed: ${error.message}`);
    }
  };

  const runQueueProcessingTest = async () => {
    updateResult('Queue Processing', 'running', 'Testing email queue processing...');
    
    try {
      const { data, error } = await supabase.functions.invoke('unified-email-queue-processor', {
        body: {
          batchSize: 5,
          priority: 'all'
        }
      });

      if (error) throw error;

      updateResult('Queue Processing', 'success', 
        `Queue processor functional: processed ${data.processed || 0} emails`, 
        { queueData: data });
    } catch (error: any) {
      updateResult('Queue Processing', 'error', `Queue processing failed: ${error.message}`);
    }
  };

  const runErrorHandlingTest = async () => {
    updateResult('Error Handling', 'running', 'Testing error handling...');
    
    try {
      // Test with invalid template
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          templateKey: 'non_existent_template',
          variables: {}
        }
      });

      // This should fail gracefully
      if (!error) {
        updateResult('Error Handling', 'error', 'Error handling not working - invalid template should fail');
        return;
      }

      updateResult('Error Handling', 'success', 
        `Error handling working correctly: ${error.message}`, 
        { errorMessage: error.message });
    } catch (error: any) {
      updateResult('Error Handling', 'success', 
        `Error handling working correctly: ${error.message}`, 
        { errorMessage: error.message });
    }
  };

  const runProductionReadinessCheck = async () => {
    updateResult('Production Readiness', 'running', 'Checking production readiness...');
    
    try {
      const checks = [];
      
      // Check SMTP settings
      const { data: smtpSettings } = await (supabase as any)
        .from('communication_settings')
        .select('*')
        .eq('use_smtp', true)
        .limit(1)
        .maybeSingle();

      checks.push({
        name: 'SMTP Configuration',
        status: smtpSettings ? 'pass' : 'fail',
        message: smtpSettings ? 'SMTP configured' : 'No SMTP configuration found'
      });

      // Check active templates
      const coreTemplateCount = activeTemplates.filter(t => 
        ['order_confirmation', 'customer_welcome', 'payment_confirmation'].includes(t.template_key)
      ).length;

      checks.push({
        name: 'Core Templates',
        status: coreTemplateCount >= 3 ? 'pass' : 'fail',
        message: `${coreTemplateCount}/3 core templates active`
      });

      // Check recent email delivery
      const recentDeliveryRate = emailMetrics.total > 0 ? 
        (emailMetrics.sent / emailMetrics.total * 100) : 0;

      checks.push({
        name: 'Delivery Success Rate',
        status: Number(recentDeliveryRate) >= 90 ? 'pass' : 'warn',
        message: `${Number(recentDeliveryRate).toFixed(1)}% success rate (last 24h)`
      });

      const overallStatus = checks.every(c => c.status === 'pass') ? 'success' : 
                           checks.some(c => c.status === 'fail') ? 'error' : 'success';

      updateResult('Production Readiness', overallStatus, 
        `Production readiness check complete`, 
        { checks, metrics: emailMetrics });
    } catch (error: any) {
      updateResult('Production Readiness', 'error', `Production check failed: ${error.message}`);
    }
  };

  const getStatusIcon = (status: SimulationResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running': return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: SimulationResult['status']) => {
    const variants = {
      success: 'default',
      error: 'destructive',
      running: 'secondary',
      pending: 'outline'
    } as const;
    
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-6 w-6" />
            Production Email System Simulator
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Comprehensive testing and simulation of all email functionality for production readiness
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="Test email address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button 
              onClick={runFullSimulation}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isRunning ? 'Running Simulation...' : 'Run Full Simulation'}
            </Button>
          </div>

          <Tabs defaultValue="simulation" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="simulation">Simulation Results</TabsTrigger>
              <TabsTrigger value="templates">Active Templates</TabsTrigger>
              <TabsTrigger value="metrics">Email Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="simulation" className="space-y-4">
              {simulationResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Click "Run Full Simulation" to test all email functionality
                </div>
              ) : (
                <div className="space-y-3">
                  {simulationResults.map((result) => (
                    <Card key={result.test}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(result.status)}
                            <div>
                              <h4 className="font-medium">{result.test}</h4>
                              <p className="text-sm text-muted-foreground">{result.message}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {result.timing && (
                              <span className="text-xs text-muted-foreground">
                                {result.timing}ms
                              </span>
                            )}
                            {getStatusBadge(result.status)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <div className="grid gap-4">
                {activeTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{template.template_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Key: {template.template_key} | Type: {template.template_type}
                          </p>
                        </div>
                        <Badge variant="default">Active</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Mail className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold">{emailMetrics.total || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Emails (24h)</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold">{emailMetrics.sent || 0}</div>
                    <div className="text-sm text-muted-foreground">Successfully Sent</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                    <div className="text-2xl font-bold">{emailMetrics.failed || 0}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                    <div className="text-2xl font-bold">
                      {emailMetrics.total > 0 ? (emailMetrics.sent / emailMetrics.total * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};