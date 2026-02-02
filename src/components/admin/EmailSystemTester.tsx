import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, TestTube, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export const EmailSystemTester = () => {
  const [isTestingOrder, setIsTestingOrder] = useState(false);
  const [isTestingSMTP, setIsTestingSMTP] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const { toast } = useToast();

  const testOrderEmailTrigger = async () => {
    setIsTestingOrder(true);
    setTestResults(null);
    
    try {
      // Find the test order #ORD17571524652132db
      const { data: order, error: orderError } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('order_number', 'ORD17571524652132db')
        .single();

      if (orderError || !order) {
        toast({
          title: "Test Order Not Found", 
          description: "Test order not found. Create a test order first or check system configuration.",
          variant: "destructive"
        });
        return;
      }

      // Update the order status to trigger email notification
      const { error: updateError } = await (supabase as any)
        .from('orders')
        .update({ 
          status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        throw updateError;
      }

      // Wait a moment for trigger to fire
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if communication event was created
      const { data: events, error: eventsError } = await (supabase as any)
        .from('communication_events')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (eventsError) {
        throw eventsError;
      }

      const latestEvent = events?.[0];
      
      setTestResults({
        success: !!latestEvent,
        order_id: order.id,
        order_number: order.order_number,
        event_created: !!latestEvent,
        event_id: latestEvent?.id,
        template_key: latestEvent?.template_key,
        status: latestEvent?.status,
        recipient: latestEvent?.recipient_email,
        created_at: latestEvent?.created_at
      });

      if (latestEvent) {
        toast({
          title: "✅ Email Event Created",
          description: `Email queued for order ${order.order_number} with template ${latestEvent.template_key}`,
        });

        // Now process the email queue
        const { error: processError } = await supabase.functions.invoke('instant-email-processor');
        if (processError) {
          console.warn('Email processing error:', processError);
        }
      } else {
        toast({
          title: "❌ No Email Event Created",
          description: "The trigger may not be working correctly.",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Test error:', error);
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsTestingOrder(false);
    }
  };

  const testSMTPConfiguration = async () => {
    setIsTestingSMTP(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: 'test@example.com',
          subject: 'SMTP Configuration Test',
          htmlContent: '<h1>Test Email</h1><p>This is a test to verify SMTP configuration.</p>',
          textContent: 'Test Email - This is a test to verify SMTP configuration.',
          test_mode: true
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: data?.success ? "✅ SMTP Test Passed" : "❌ SMTP Test Failed",
        description: data?.message || "SMTP configuration tested",
        variant: data?.success ? "default" : "destructive"
      });

    } catch (error: any) {
      toast({
        title: "❌ SMTP Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsTestingSMTP(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Email System Production Test
        </CardTitle>
        <CardDescription>
          Test the email system using the latest test order as case study
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testOrderEmailTrigger}
            disabled={isTestingOrder}
            className="flex items-center gap-2"
          >
            {isTestingOrder ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Test Order Email Trigger
          </Button>
          
          <Button 
            onClick={testSMTPConfiguration}
            disabled={isTestingSMTP}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isTestingSMTP ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Test SMTP Config
          </Button>
        </div>

        {testResults && (
          <div className="p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              {testResults.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              Test Results
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Order: {testResults.order_number}</div>
              <div>
                Event Created: 
                <Badge variant={testResults.event_created ? "default" : "destructive"} className="ml-1">
                  {testResults.event_created ? "Yes" : "No"}
                </Badge>
              </div>
              {testResults.template_key && (
                <>
                  <div>Template: {testResults.template_key}</div>
                  <div>Status: {testResults.status}</div>
                  <div>Recipient: {testResults.recipient}</div>
                  <div>Created: {new Date(testResults.created_at).toLocaleString()}</div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p><strong>Test Steps:</strong></p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Updates test order status to 'ready'</li>
            <li>Verifies database trigger creates communication_event</li>
            <li>Processes email queue via instant-email-processor</li>
            <li>Checks end-to-end email delivery pipeline</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};