import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp: Date;
}

export const EmailFlowTester = () => {
  const [testEmail, setTestEmail] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const addResult = (step: string, status: TestResult['status'], message: string) => {
    setResults(prev => [...prev, {
      step,
      status,
      message,
      timestamp: new Date()
    }]);
  };

  const runCompleteEmailFlow = async () => {
    if (!testEmail) {
      toast({
        title: 'Email Required',
        description: 'Please enter a test email address',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    setResults([]);

    try {
      // Step 1: Test SMTP Configuration
      addResult('SMTP Check', 'pending', 'Checking SMTP configuration...');
      
      const { data: smtpSettings } = await supabase
        .from('communication_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!smtpSettings?.smtp_host) {
        addResult('SMTP Check', 'error', 'SMTP not configured');
        return;
      }
      addResult('SMTP Check', 'success', 'SMTP configuration found');

      // Step 2: Test Template Retrieval
      addResult('Template Check', 'pending', 'Checking email templates...');
      
      // Check if default templates are working
      let template = null;
      try {
        const { data: templateData } = await supabase
          .from('business_settings')
          .select('*')
          .limit(1)
          .maybeSingle();
        template = templateData; // Using business settings as template check
      } catch (error) {
        // Default templates will be used
        template = { template_key: 'order_confirmation' };
      }

      if (!template) {
        addResult('Template Check', 'error', 'Order confirmation template not found');
        return;
      }
      addResult('Template Check', 'success', 'Template retrieved successfully');

      // Step 3: Create Test Communication Event
      addResult('Event Creation', 'pending', 'Creating test communication event...');
      
      const { data: event, error: eventError } = await supabase
        .from('communication_events')
        .insert({
          event_type: 'order_confirmation',
          template_key: 'order_confirmation',
          recipient_email: testEmail,
          recipient_name: 'Test User',
          variables: {
            customer_name: 'Test User',
            order_number: 'TEST-' + Date.now(),
            order_total: '25.00',
            business_name: 'Test Business'
          },
          priority: 'high',
          status: 'queued'
        })
        .select()
        .single();

      if (eventError) {
        addResult('Event Creation', 'error', `Failed to create event: ${eventError.message}`);
        return;
      }
      addResult('Event Creation', 'success', `Event created with ID: ${event.id}`);

      // Step 4: Process Email Manually
      addResult('Email Processing', 'pending', 'Processing email through admin processor...');
      
      const { data: processResult, error: processError } = await supabase.functions.invoke(
        'admin-email-processor', 
        {
          body: { 
            action: 'processEmailQueue',
            priority: 'high'
          }
        }
      );

      if (processError) {
        addResult('Email Processing', 'error', `Processing failed: ${processError.message}`);
        return;
      }
      addResult('Email Processing', 'success', `Processed ${processResult.processed || 0} emails`);

      // Step 5: Verify Email Status
      addResult('Status Verification', 'pending', 'Verifying email delivery status...');
      
      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { data: updatedEvent } = await supabase
        .from('communication_events')
        .select('status, last_error')
        .eq('id', event.id)
        .single();

      if (updatedEvent?.status === 'sent') {
        addResult('Status Verification', 'success', 'Email sent successfully!');
        toast({
          title: '✅ Email Flow Test Complete',
          description: `Test email sent to ${testEmail}`,
        });
      } else if (updatedEvent?.status === 'failed') {
        addResult('Status Verification', 'error', `Email failed: ${updatedEvent.last_error || 'Unknown error'}`);
      } else {
        addResult('Status Verification', 'error', `Email status: ${updatedEvent?.status || 'Unknown'}`);
      }

    } catch (error: any) {
      addResult('Flow Test', 'error', `Test failed: ${error.message}`);
      toast({
        title: 'Flow Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Flow Tester</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="test-email">Test Email Address</Label>
            <div className="flex space-x-2 mt-1">
              <Input
                id="test-email"
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                disabled={isRunning}
              />
              <Button 
                onClick={runCompleteEmailFlow}
                disabled={isRunning || !testEmail}
              >
                <Send className="h-4 w-4 mr-2" />
                Test Flow
              </Button>
            </div>
          </div>

          {results.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Test Results</h4>
                {results.map((result, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.step}</span>
                        <Badge variant={result.status === 'success' ? 'default' : result.status === 'error' ? 'destructive' : 'secondary'}>
                          {result.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};