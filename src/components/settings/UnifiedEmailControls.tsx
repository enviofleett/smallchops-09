import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Send, TestTube, Activity, CheckCircle, AlertTriangle, Zap } from 'lucide-react';

export const UnifiedEmailControls = () => {
  const [testEmail, setTestEmail] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);

  const testEmailConnection = async () => {
    if (!testEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          subject: 'Unified SMTP Test - ' + new Date().toLocaleString(),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #f59e0b;">✅ Unified SMTP Connection Test</h2>
              <p>Congratulations! Your unified SMTP configuration is working correctly.</p>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Test Details:</strong></p>
                <ul>
                  <li>Sent at: ${new Date().toLocaleString()}</li>
                  <li>System: Unified SMTP Sender</li>
                  <li>Status: Production Ready ✅</li>
                </ul>
              </div>
              <p>Your email system is now ready for production use!</p>
            </div>
          `,
          text: `Unified SMTP Test - Sent at ${new Date().toLocaleString()}. System is production ready!`
        }
      });

      if (error) {
        throw error;
      }

      setConnectionStatus('success');
      toast.success('✅ Test email sent successfully via Unified SMTP!');
    } catch (error: any) {
      console.error('Test email error:', error);
      setConnectionStatus('error');
      toast.error(`❌ Test failed: ${error.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const processEmailQueue = async () => {
    setIsProcessingQueue(true);

    try {
      const { data, error } = await supabase.functions.invoke('unified-email-queue-processor', {
        body: {
          batchSize: 50,
          priority: 'all'
        }
      });

      if (error) {
        throw error;
      }

      const result = data;
      toast.success(
        `✅ Queue processed: ${result.successful} sent, ${result.failed} failed`,
        {
          description: `Total emails processed: ${result.total_events}`
        }
      );
    } catch (error: any) {
      console.error('Queue processing error:', error);
      toast.error(`❌ Queue processing failed: ${error.message}`);
    } finally {
      setIsProcessingQueue(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Unified Email System
          </h3>
          <p className="text-sm text-muted-foreground">
            Production-ready SMTP system with queue processing and monitoring
          </p>
        </div>
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          <Activity className="h-3 w-3 mr-1" />
          Production Ready
        </Badge>
      </div>

      {/* Key Features Alert */}
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Unified SMTP System Active:</strong> All email functions now use a single, 
          optimized SMTP sender with rate limiting, template support, and comprehensive logging.
        </AlertDescription>
      </Alert>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Connection Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Test SMTP Connection
            </CardTitle>
            <CardDescription>
              Verify your unified SMTP configuration with a test email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Test Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="your-email@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button 
              onClick={testEmailConnection} 
              disabled={isTestingConnection || !testEmail}
              className="w-full"
            >
              <TestTube className="mr-2 h-4 w-4" />
              {isTestingConnection ? 'Sending Test Email...' : 'Send Test Email'}
            </Button>

            {connectionStatus && (
              <Alert className={connectionStatus === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                {connectionStatus === 'success' 
                  ? <CheckCircle className="h-4 w-4 text-green-600" />
                  : <AlertTriangle className="h-4 w-4 text-red-600" />
                }
                <AlertDescription className={connectionStatus === 'success' ? 'text-green-800' : 'text-red-800'}>
                  {connectionStatus === 'success' 
                    ? 'Unified SMTP test successful! Check your inbox.' 
                    : 'Test failed. Please check your SMTP settings.'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Queue Processing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Process Email Queue
            </CardTitle>
            <CardDescription>
              Process queued emails through the unified system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Process all queued emails using the unified SMTP sender with:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Rate limiting and throttling</li>
                <li>Automatic retry logic</li>
                <li>Comprehensive error logging</li>
                <li>Real-time status updates</li>
              </ul>
            </div>
            <Button 
              onClick={processEmailQueue} 
              disabled={isProcessingQueue}
              className="w-full"
              variant="default"
            >
              <Send className="mr-2 h-4 w-4" />
              {isProcessingQueue ? 'Processing Queue...' : 'Process Email Queue'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Current status of the unified email system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Unified SMTP Active</p>
                <p className="text-sm text-green-700">Production ready sender</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Queue Processing</p>
                <p className="text-sm text-blue-700">Automated processing active</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <Mail className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium text-purple-900">Templates Ready</p>
                <p className="text-sm text-purple-700">Template support enabled</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};