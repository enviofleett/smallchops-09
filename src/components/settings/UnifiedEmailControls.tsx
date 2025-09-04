import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EmailSystemStatus } from './EmailSystemStatus';
import { Mail, Send, TestTube, Activity, CheckCircle, AlertTriangle, Zap } from 'lucide-react';

export const UnifiedEmailControls = () => {
  const [testEmail, setTestEmail] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    provider?: string;
    source?: string;
    message?: string;
    lastChecked?: Date;
  }>({
    isConnected: false
  });

  const [healthCheckResult, setHealthCheckResult] = useState<any>(null);

  const testSMTPAuthentication = async () => {
    setIsTestingConnection(true);
    setConnectionStatus({
      isConnected: false
    });
    setHealthCheckResult(null);

    try {
      console.log('🔍 Running production SMTP authentication health check...');
      
      const { data, error } = await supabase.functions.invoke('smtp-auth-healthcheck', {
        body: {}
      });

      // Handle Supabase function errors (network/invocation issues)
      if (error) {
        console.error('❌ Function invocation error:', error);
        setConnectionStatus({
          isConnected: false,
          message: error.message,
          lastChecked: new Date()
        });
        setHealthCheckResult({ success: false, error: error.message });
        toast.error('❌ Health check failed', {
          description: error.message || 'Failed to connect to health check service'
        });
        return;
      }

      console.log('📊 Health check result:', data);
      setHealthCheckResult(data);

      if (data.success && data.authenticated) {
        setConnectionStatus({
          isConnected: true,
          provider: data.provider?.host,
          source: data.provider?.source,
          message: data.message,
          lastChecked: new Date()
        });
        
        const sourceLabel = data.provider?.source === 'function_secrets' ? 'Function Secrets (Production)' : 'Database (Development)';
        toast.success('SMTP Authentication Verified', {
          description: `Successfully authenticated with ${data.provider?.host} via ${sourceLabel}`,
        });
      } else {
        setConnectionStatus({
          isConnected: false,
          provider: data.provider?.host,
          source: data.provider?.source,
          message: data.error || data.message,
          lastChecked: new Date()
        });
        
        toast.error('SMTP Authentication Failed', {
          description: data.error || "Authentication failed. Check SMTP credentials."
        });
      }
    } catch (error: any) {
      console.error('❌ Unexpected health check error:', error);
      setConnectionStatus({
        isConnected: false,
        message: error.message,
        lastChecked: new Date()
      });
      setHealthCheckResult({ success: false, error: error.message });
      toast.error('❌ Unexpected error during health check', {
        description: error.message
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const sendActualTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          templateKey: 'smtp_connection_test',
          variables: {
            timestamp: new Date().toLocaleString(),
            test_message: 'Production SMTP Test'
          }
        }
      });

      if (error) throw error;

      toast.success('✅ Production test email sent successfully!');
    } catch (error: any) {
      toast.error(`❌ Test email failed: ${error.message}`);
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
      {/* Native SMTP System Status */}
      <EmailSystemStatus />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Native SMTP Email System
          </h3>
          <p className="text-sm text-muted-foreground">
            All email communications use your configured SMTP settings
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
              Production SMTP Health Check
            </CardTitle>
            <CardDescription>
              Verify production SMTP authentication and readiness (no email sent)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={testSMTPAuthentication} 
              disabled={isTestingConnection}
              className="w-full"
            >
              <TestTube className="mr-2 h-4 w-4" />
              {isTestingConnection ? 'Checking Authentication...' : 'Check SMTP Authentication'}
            </Button>

            {connectionStatus.lastChecked && (
              <Alert className={connectionStatus.isConnected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                {connectionStatus.isConnected 
                  ? <CheckCircle className="h-4 w-4 text-green-600" />
                  : <AlertTriangle className="h-4 w-4 text-red-600" />
                }
                <AlertDescription className={connectionStatus.isConnected ? 'text-green-800' : 'text-red-800'}>
                  <div className="flex items-center justify-between">
                    <div>
                      {connectionStatus.isConnected 
                        ? 'Production SMTP authentication successful! System is ready.' 
                        : connectionStatus.message || 'Authentication failed. Check SMTP credentials.'}
                    </div>
                    {connectionStatus.provider && connectionStatus.source && (
                      <div className="flex items-center gap-2">
                        <Badge variant={connectionStatus.source === 'function_secrets' ? "default" : "secondary"}>
                          {connectionStatus.source === 'function_secrets' ? 'Production' : 'Development'}
                        </Badge>
                        <span className="text-xs">{connectionStatus.provider}</span>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {healthCheckResult && connectionStatus.isConnected && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">✅ Production Readiness Confirmed</h4>
                <div className="text-sm text-green-800 space-y-1">
                  <p><strong>Host:</strong> {healthCheckResult.provider?.host}:{healthCheckResult.provider?.port}</p>
                  <p><strong>Source:</strong> {healthCheckResult.provider?.source === 'function_secrets' ? 'Function Secrets (Production)' : 'Database (Fallback)'}</p>
                  <p><strong>Authentication:</strong> {healthCheckResult.auth?.method} with {healthCheckResult.auth?.tlsMode} encryption</p>
                  <p><strong>Connection Time:</strong> {healthCheckResult.timing?.totalMs}ms</p>
                </div>
              </div>
            )}

            {/* Optional: Send actual test email */}
            {connectionStatus.isConnected && (
              <div className="mt-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="test-email">Send Test Email (Optional)</Label>
                  <Input
                    id="test-email"
                    type="email"
                    placeholder="your-email@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={sendActualTestEmail} 
                  disabled={!testEmail}
                  variant="outline"
                  className="w-full mt-2"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send Test Email
                </Button>
              </div>
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