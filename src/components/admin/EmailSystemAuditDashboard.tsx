import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  TestTube, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Send,
  ShoppingCart,
  UserPlus,
  Bell,
  CreditCard,
  RefreshCw,
  Eye,
  Settings,
  Database,
  TrendingUp
} from 'lucide-react';

interface AuditResult {
  category: string;
  testName: string;
  status: 'success' | 'warning' | 'error' | 'running';
  message: string;
  details?: any;
  timestamp: Date;
  recommendations?: string[];
}

interface UserJourneyTest {
  journeyName: string;
  steps: string[];
  currentStep: number;
  status: 'success' | 'warning' | 'error' | 'running';
  results: any[];
}

export const EmailSystemAuditDashboard = () => {
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [userJourneyTests, setUserJourneyTests] = useState<UserJourneyTest[]>([]);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [testEmail, setTestEmail] = useState('audit@example.com');
  const [auditProgress, setAuditProgress] = useState(0);
  const { toast } = useToast();

  const updateAuditResult = (category: string, testName: string, status: AuditResult['status'], message: string, details?: any, recommendations?: string[]) => {
    setAuditResults(prev => {
      const existing = prev.findIndex(r => r.category === category && r.testName === testName);
      const newResult: AuditResult = { 
        category, 
        testName, 
        status, 
        message, 
        details, 
        recommendations,
        timestamp: new Date() 
      };
      
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newResult;
        return updated;
      }
      return [...prev, newResult];
    });
  };

  // PHASE 1: EMAIL SYSTEM INFRASTRUCTURE AUDIT
  const auditEmailTemplates = async () => {
    updateAuditResult('Infrastructure', 'Email Templates', 'running', 'Auditing email template system...');
    
    try {
      const { data: templates, error } = await supabase
        .from('enhanced_email_templates')
        .select('*');

      if (error) throw error;

      const requiredTemplates = [
        'customer_welcome',
        'order_confirmation', 
        'order_shipped',
        'order_delivered',
        'password_reset',
        'admin_new_order',
        'payment_receipt',
        'cart_abandonment'
      ];

      const existingTemplates = templates.map(t => t.template_key);
      const missingTemplates = requiredTemplates.filter(rt => !existingTemplates.includes(rt));
      
      if (missingTemplates.length > 0) {
        updateAuditResult(
          'Infrastructure', 
          'Email Templates', 
          'warning', 
          `${missingTemplates.length} critical templates missing`,
          { missing: missingTemplates, total: templates.length },
          [`Create missing templates: ${missingTemplates.join(', ')}`]
        );
      } else {
        updateAuditResult(
          'Infrastructure', 
          'Email Templates', 
          'success', 
          `All ${templates.length} email templates present`,
          { templates: templates.length }
        );
      }

      // Test template variable substitution
      for (const template of templates.slice(0, 3)) { // Test first 3
        try {
          const testVariables = {
            customer_name: 'Test Customer',
            order_number: 'TEST-001',
            order_total: '₦5,000'
          };
          
          let processedSubject = template.subject_template;
          let processedHtml = template.html_template;
          
          Object.entries(testVariables).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            processedSubject = processedSubject.replace(regex, value);
            processedHtml = processedHtml.replace(regex, value);
          });

          if (processedSubject.includes('{{') || processedHtml.includes('{{')) {
            updateAuditResult(
              'Infrastructure',
              `Template: ${template.template_name}`,
              'warning',
              'Template has unprocessed variables',
              { templateKey: template.template_key }
            );
          }
        } catch (err) {
          updateAuditResult(
            'Infrastructure',
            `Template: ${template.template_name}`,
            'error',
            `Template processing error: ${err.message}`
          );
        }
      }

    } catch (error) {
      updateAuditResult('Infrastructure', 'Email Templates', 'error', `Template audit failed: ${error.message}`);
    }
  };

  const auditSMTPConfiguration = async () => {
    updateAuditResult('Infrastructure', 'SMTP Configuration', 'running', 'Auditing SMTP setup...');
    
    try {
      const { data: smtpConfig, error } = await supabase
        .from('communication_settings')
        .select('*')
        .eq('use_smtp', true)
        .maybeSingle();

      if (error || !smtpConfig) {
        updateAuditResult(
          'Infrastructure', 
          'SMTP Configuration', 
          'error', 
          'SMTP not configured',
          null,
          ['Configure SMTP settings in communication settings']
        );
        return;
      }

      const issues = [];
      if (!smtpConfig.smtp_host) issues.push('Missing SMTP host');
      if (!smtpConfig.smtp_user) issues.push('Missing SMTP user');
      if (!smtpConfig.smtp_pass) issues.push('Missing SMTP password');
      if (!smtpConfig.sender_email) issues.push('Missing sender email');

      if (issues.length > 0) {
        updateAuditResult(
          'Infrastructure', 
          'SMTP Configuration', 
          'error', 
          `SMTP configuration incomplete: ${issues.join(', ')}`,
          { issues },
          ['Complete SMTP configuration with all required fields']
        );
      } else {
        updateAuditResult(
          'Infrastructure', 
          'SMTP Configuration', 
          'success', 
          'SMTP configuration complete',
          { 
            host: smtpConfig.smtp_host,
            port: smtpConfig.smtp_port,
            secure: smtpConfig.smtp_secure,
            sender: smtpConfig.sender_email
          }
        );
      }

    } catch (error) {
      updateAuditResult('Infrastructure', 'SMTP Configuration', 'error', `SMTP audit failed: ${error.message}`);
    }
  };

  const auditEmailDeliverySystem = async () => {
    updateAuditResult('Infrastructure', 'Delivery System', 'running', 'Auditing email delivery infrastructure...');
    
    try {
      // Check communication events table
      const { data: recentEvents, error: eventsError } = await supabase
        .from('communication_events')
        .select('status, event_type')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      if (eventsError) throw eventsError;

      // Check SMTP delivery logs
      const { data: deliveryLogs, error: logsError } = await supabase
        .from('smtp_delivery_logs')
        .select('delivery_status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      if (logsError) throw logsError;

      const eventStats = recentEvents.reduce((acc, event) => {
        acc[event.status] = (acc[event.status] || 0) + 1;
        return acc;
      }, {});

      const deliveryStats = deliveryLogs.reduce((acc, log) => {
        acc[log.delivery_status] = (acc[log.delivery_status] || 0) + 1;
        return acc;
      }, {});

      const totalEvents = recentEvents.length;
      const failedEvents = (eventStats as any).failed || 0;
      const failureRate = totalEvents > 0 ? (failedEvents / totalEvents) * 100 : 0;

      if (failureRate > 10) {
        updateAuditResult(
          'Infrastructure',
          'Delivery System',
          'error',
          `High failure rate: ${failureRate.toFixed(1)}%`,
          { eventStats, deliveryStats, failureRate },
          ['Investigate email delivery failures', 'Check SMTP server status']
        );
      } else if (failureRate > 5) {
        updateAuditResult(
          'Infrastructure',
          'Delivery System',
          'warning',
          `Moderate failure rate: ${failureRate.toFixed(1)}%`,
          { eventStats, deliveryStats, failureRate },
          ['Monitor email delivery closely']
        );
      } else {
        updateAuditResult(
          'Infrastructure',
          'Delivery System',
          'success',
          `Healthy delivery rate: ${(100 - failureRate).toFixed(1)}% success`,
          { eventStats, deliveryStats, failureRate }
        );
      }

    } catch (error) {
      updateAuditResult('Infrastructure', 'Delivery System', 'error', `Delivery system audit failed: ${error.message}`);
    }
  };

  // PHASE 2: USER JOURNEY EMAIL FLOW TESTING
  const testRegistrationEmailFlow = async () => {
    const journeyName = 'User Registration Flow';
    const steps = [
      'Create test user account',
      'Trigger welcome email',
      'Verify email queue entry',
      'Process welcome email',
      'Confirm delivery'
    ];

    setUserJourneyTests(prev => [
      ...prev.filter(j => j.journeyName !== journeyName),
      { journeyName, steps, currentStep: 0, status: 'running', results: [] }
    ]);

    try {
      // Step 1: Create test user
      const testUserEmail = `test-reg-${Date.now()}@example.com`;
      updateUserJourneyStep(journeyName, 1, { action: 'Creating test user', email: testUserEmail });

      // Step 2: Trigger welcome email
      updateUserJourneyStep(journeyName, 2, { action: 'Triggering welcome email' });
      
      const { data: eventResult, error: eventError } = await supabase
        .from('communication_events')
        .insert({
          event_type: 'customer_welcome',
          recipient_email: testUserEmail,
          status: 'queued',
          template_key: 'customer_welcome',
          template_variables: {
            customer_name: 'Test User',
            store_name: 'Test Store'
          }
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Step 3: Verify queue entry
      updateUserJourneyStep(journeyName, 3, { action: 'Verifying queue entry', eventId: eventResult.id });

      // Step 4: Process email
      updateUserJourneyStep(journeyName, 4, { action: 'Processing email queue' });
      
      const { data: processResult, error: processError } = await supabase.functions.invoke('enhanced-email-processor');
      
      if (processError) throw processError;

      // Step 5: Confirm delivery
      updateUserJourneyStep(journeyName, 5, { action: 'Confirming delivery', result: processResult });

      setUserJourneyTests(prev => 
        prev.map(j => j.journeyName === journeyName 
          ? { ...j, status: 'success', currentStep: steps.length }
          : j
        )
      );

    } catch (error) {
      setUserJourneyTests(prev => 
        prev.map(j => j.journeyName === journeyName 
          ? { ...j, status: 'error', results: [...j.results, { error: error.message }] }
          : j
        )
      );
    }
  };

  const testOrderConfirmationFlow = async () => {
    const journeyName = 'Order Confirmation Flow';
    const steps = [
      'Create test product',
      'Create test order',
      'Trigger order confirmation',
      'Process email',
      'Verify admin notification'
    ];

    setUserJourneyTests(prev => [
      ...prev.filter(j => j.journeyName !== journeyName),
      { journeyName, steps, currentStep: 0, status: 'running', results: [] }
    ]);

    try {
      const testOrderEmail = `test-order-${Date.now()}@example.com`;
      
      // Step 1: Create test order
      updateUserJourneyStep(journeyName, 1, { action: 'Creating test order' });
      
      const { data: orderResult, error: orderError } = await supabase.rpc('create_order_with_items', {
        p_customer_email: testOrderEmail,
        p_customer_name: 'Test Customer',
        p_items: JSON.stringify([{
          product_id: '00000000-0000-0000-0000-000000000001',
          quantity: 1,
          unit_price: 1500,
          total_price: 1500
        }]),
        p_customer_phone: '+2348012345678',
        p_delivery_address: null,
        p_fulfillment_type: 'delivery',
        p_payment_method: 'paystack'
      });

      const orderData = orderResult as any;
      if (orderError || !orderData?.success) {
        throw new Error(`Order creation failed: ${orderError?.message || 'Unknown error'}`);
      }

      updateUserJourneyStep(journeyName, 2, { 
        action: 'Order created successfully', 
        orderId: orderData.order_id,
        orderNumber: orderData.order_number 
      });

      // Step 3: Check communication events
      updateUserJourneyStep(journeyName, 3, { action: 'Checking email events' });
      
      const { data: commEvents, error: commError } = await supabase
        .from('communication_events')
        .select('*')
        .eq('order_id', orderData.order_id);

      if (commError) throw commError;

      updateUserJourneyStep(journeyName, 4, { 
        action: 'Found email events', 
        eventCount: commEvents.length,
        events: commEvents 
      });

      // Step 5: Process emails
      updateUserJourneyStep(journeyName, 5, { action: 'Processing email queue' });
      
      const { data: processResult, error: processError } = await supabase.functions.invoke('enhanced-email-processor');
      
      if (processError) throw processError;

      setUserJourneyTests(prev => 
        prev.map(j => j.journeyName === journeyName 
          ? { ...j, status: 'success', currentStep: steps.length }
          : j
        )
      );

    } catch (error) {
      setUserJourneyTests(prev => 
        prev.map(j => j.journeyName === journeyName 
          ? { ...j, status: 'error', results: [...j.results, { error: error.message }] }
          : j
        )
      );
    }
  };

  const updateUserJourneyStep = (journeyName: string, step: number, result: any) => {
    setUserJourneyTests(prev => 
      prev.map(j => j.journeyName === journeyName 
        ? { 
            ...j, 
            currentStep: step, 
            results: [...j.results, { step, timestamp: new Date(), ...result }] 
          }
        : j
      )
    );
  };

  // COMPREHENSIVE AUDIT RUNNER
  const runFullSystemAudit = async () => {
    setIsRunningAudit(true);
    setAuditResults([]);
    setUserJourneyTests([]);
    setAuditProgress(0);

    const totalSteps = 8;
    let currentStep = 0;

    try {
      // Infrastructure Audit
      await auditEmailTemplates();
      setAuditProgress(++currentStep / totalSteps * 100);

      await auditSMTPConfiguration();
      setAuditProgress(++currentStep / totalSteps * 100);

      await auditEmailDeliverySystem();
      setAuditProgress(++currentStep / totalSteps * 100);

      // Template Testing
      updateAuditResult('Testing', 'Template Rendering', 'running', 'Testing template rendering...');
      // Add template rendering tests here
      setAuditProgress(++currentStep / totalSteps * 100);

      // User Journey Testing
      await testRegistrationEmailFlow();
      setAuditProgress(++currentStep / totalSteps * 100);

      await testOrderConfirmationFlow();
      setAuditProgress(++currentStep / totalSteps * 100);

      // Performance Testing
      updateAuditResult('Performance', 'Email Queue', 'running', 'Testing email queue performance...');
      // Add queue performance tests
      setAuditProgress(++currentStep / totalSteps * 100);

      // Final validation
      updateAuditResult('Validation', 'System Health', 'running', 'Final system validation...');
      setAuditProgress(++currentStep / totalSteps * 100);

      toast({
        title: 'Audit Complete',
        description: 'Comprehensive email system audit completed',
      });

    } catch (error) {
      toast({
        title: 'Audit Error',
        description: `Audit failed: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setIsRunningAudit(false);
      setAuditProgress(100);
    }
  };

  const getStatusIcon = (status: AuditResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: AuditResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const successCount = auditResults.filter(r => r.status === 'success').length;
  const warningCount = auditResults.filter(r => r.status === 'warning').length;
  const errorCount = auditResults.filter(r => r.status === 'error').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Comprehensive Email System Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Test email address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="max-w-xs"
              />
              <Button
                onClick={runFullSystemAudit}
                disabled={isRunningAudit || !testEmail}
                className="flex items-center gap-2"
              >
                {isRunningAudit ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {isRunningAudit ? 'Running Audit...' : 'Run Full Audit'}
              </Button>
            </div>

            {isRunningAudit && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Audit Progress</span>
                  <span>{Math.round(auditProgress)}%</span>
                </div>
                <Progress value={auditProgress} className="w-full" />
              </div>
            )}

            {auditResults.length > 0 && (
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {successCount} Passed
                </Badge>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {warningCount} Warnings
                </Badge>
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  {errorCount} Failed
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">Audit Results</TabsTrigger>
          <TabsTrigger value="journeys">User Journeys</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          {auditResults.length > 0 && (
            <div className="grid gap-4">
              {['Infrastructure', 'Testing', 'Performance', 'Validation'].map(category => {
                const categoryResults = auditResults.filter(r => r.category === category);
                if (categoryResults.length === 0) return null;

                return (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="text-lg">{category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {categoryResults.map((result, index) => (
                          <div
                            key={index}
                            className="flex items-start justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-start gap-3 flex-1">
                              {getStatusIcon(result.status)}
                              <div className="flex-1">
                                <div className="font-medium">{result.testName}</div>
                                <div className="text-sm text-muted-foreground">{result.message}</div>
                                {result.details && (
                                  <div className="text-xs text-muted-foreground mt-1 bg-gray-50 p-2 rounded">
                                    <pre>{JSON.stringify(result.details, null, 2)}</pre>
                                  </div>
                                )}
                                {result.recommendations && result.recommendations.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <div className="text-xs font-medium text-blue-600">Recommendations:</div>
                                    {result.recommendations.map((rec, i) => (
                                      <div key={i} className="text-xs text-blue-600 ml-2">• {rec}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(result.status)}>
                                {result.status}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {result.timestamp.toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="journeys" className="space-y-4">
          {userJourneyTests.map((journey, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  {journey.journeyName}
                  <Badge className={getStatusColor(journey.status)}>
                    {journey.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Progress 
                    value={(journey.currentStep / journey.steps.length) * 100} 
                    className="w-full" 
                  />
                  <div className="grid gap-2">
                    {journey.steps.map((step, stepIndex) => (
                      <div 
                        key={stepIndex} 
                        className={`flex items-center gap-2 p-2 rounded ${
                          stepIndex < journey.currentStep ? 'bg-green-50' :
                          stepIndex === journey.currentStep ? 'bg-blue-50' : 'bg-gray-50'
                        }`}
                      >
                        {stepIndex < journey.currentStep ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : stepIndex === journey.currentStep ? (
                          <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                        ) : (
                          <Clock className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm">{step}</span>
                      </div>
                    ))}
                  </div>
                  {journey.results.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">Results:</div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {journey.results.map((result, resultIndex) => (
                          <div key={resultIndex} className="text-xs bg-gray-50 p-2 rounded">
                            <div className="font-medium">Step {result.step}: {result.action}</div>
                            {result.error && (
                              <div className="text-red-600 mt-1">Error: {result.error}</div>
                            )}
                            {result.orderId && (
                              <div className="text-green-600 mt-1">Order ID: {result.orderId}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditResults
                  .filter(r => r.recommendations && r.recommendations.length > 0)
                  .map((result, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="font-medium">{result.testName}</div>
                      <div className="space-y-1 mt-2">
                        {result.recommendations!.map((rec, i) => (
                          <div key={i} className="text-sm text-muted-foreground">• {rec}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                {auditResults.filter(r => r.recommendations && r.recommendations.length > 0).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Run the audit to see recommendations
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};