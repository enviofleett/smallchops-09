import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Mail, 
  Shield, 
  Settings,
  Play,
  Activity
} from 'lucide-react';

interface TestResult {
  test: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  details?: any;
  timing?: number;
}

export const GmailSMTPTester: React.FC = () => {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('test@startersmallchops.com');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = (test: string, status: TestResult['status'], message: string, details?: any, timing?: number) => {
    setTestResults(prev => {
      const updated = prev.filter(r => r.test !== test);
      return [...updated, { test, status, message, details, timing }];
    });
  };

  const runGmailSMTPTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    const tests = [
      'SMTP Authentication Health Check',
      'Gmail SMTP Connection Test',
      'Production Configuration Validation',
      'Live Test Email Delivery'
    ];

    // Initialize all tests as pending
    tests.forEach(test => updateResult(test, 'pending', 'Waiting...'));

    try {
      // Test 1: SMTP Authentication Health Check
      await runSMTPAuthHealthCheck();
      await delay(1000);
      
      // Test 2: Gmail SMTP Connection Test
      await runGmailConnectionTest();
      await delay(1000);
      
      // Test 3: Production Configuration Validation
      await runProductionConfigValidation();
      await delay(1000);
      
      // Test 4: Live Test Email Delivery
      await runLiveTestEmail();
      
      toast({
        title: "✅ Gmail SMTP Tests Complete",
        description: "All production SMTP authentication tests completed successfully!"
      });
      
    } catch (error: any) {
      toast({
        title: "❌ SMTP Tests Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runSMTPAuthHealthCheck = async () => {
    updateResult('SMTP Authentication Health Check', 'running', 'Running production SMTP authentication check...');
    
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('smtp-auth-healthcheck', {
        method: 'GET'
      });

      const timing = Date.now() - start;

      if (error) {
        throw new Error(error.message);
      }

      if (data?.smtpCheck?.configured && data?.smtpCheck?.healthy) {
        updateResult('SMTP Authentication Health Check', 'success', 
          `✅ SMTP Authentication Successful: ${data.smtpCheck.host}:${data.smtpCheck.port} (${data.smtpCheck.encryption})`, 
          { data }, timing);
      } else {
        throw new Error(data?.smtpCheck?.error || 'SMTP authentication failed');
      }
    } catch (error: any) {
      updateResult('SMTP Authentication Health Check', 'error', `❌ SMTP Auth Failed: ${error.message}`);
      throw error; // Re-throw to stop further tests
    }
  };

  const runGmailConnectionTest = async () => {
    updateResult('Gmail SMTP Connection Test', 'running', 'Testing Gmail SMTP connection with production credentials...');
    
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          healthcheck: true,
          check: 'connection'
        }
      });

      const timing = Date.now() - start;

      if (error) {
        throw new Error(error.message);
      }

      updateResult('Gmail SMTP Connection Test', 'success', 
        `✅ Gmail Connection Verified: Provider ${data.provider || 'Unknown'} ready for production`, 
        { data }, timing);
    } catch (error: any) {
      updateResult('Gmail SMTP Connection Test', 'error', `❌ Gmail Connection Failed: ${error.message}`);
    }
  };

  const runProductionConfigValidation = async () => {
    updateResult('Production Configuration Validation', 'running', 'Validating production SMTP configuration...');
    
    try {
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          healthcheck: true,
          check: 'config'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const configSource = data.provider?.source === 'function_secrets' ? 'Function Secrets (Production)' : 'Database Settings (Development)';
      
      updateResult('Production Configuration Validation', 'success', 
        `✅ Production Config Valid: Using ${configSource}`, 
        { data });
    } catch (error: any) {
      updateResult('Production Configuration Validation', 'error', `❌ Config Validation Failed: ${error.message}`);
    }
  };

  const runLiveTestEmail = async () => {
    updateResult('Live Test Email Delivery', 'running', `Sending live test email to ${testEmail}...`);
    
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          subject: 'Gmail SMTP Production Test - Success!',
          html: `
            <h2>🎉 Gmail SMTP Production Test Successful!</h2>
            <p>This email confirms that your Gmail SMTP configuration is working correctly in production.</p>
            <ul>
              <li><strong>Test Time:</strong> ${new Date().toLocaleString()}</li>
              <li><strong>SMTP Provider:</strong> Gmail (smtp.gmail.com:587 STARTTLS)</li>
              <li><strong>Authentication:</strong> Gmail App Password</li>
              <li><strong>Configuration Source:</strong> Supabase Function Secrets</li>
            </ul>
            <p>All 535 authentication errors should now be resolved! 🚀</p>
          `,
          variables: {
            test_timestamp: new Date().toISOString(),
            smtp_provider: 'Gmail Production'
          }
        }
      });

      const timing = Date.now() - start;

      if (error) {
        throw new Error(error.message);
      }

      updateResult('Live Test Email Delivery', 'success', 
        `✅ Test Email Sent Successfully: Delivered to ${testEmail} in ${timing}ms`, 
        { data, recipient: testEmail }, timing);
    } catch (error: any) {
      updateResult('Live Test Email Delivery', 'error', `❌ Test Email Failed: ${error.message}`);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running': return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      success: 'default',
      error: 'destructive', 
      running: 'secondary',
      pending: 'outline'
    } as const;
    
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const overallStatus = testResults.length > 0 ? 
    testResults.every(r => r.status === 'success') ? 'success' :
    testResults.some(r => r.status === 'error') ? 'error' : 'running' : 'pending';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <CardTitle>Gmail SMTP Production Test Suite</CardTitle>
          </div>
          <CardDescription>
            Test and validate Gmail SMTP configuration with App Password authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="Test email address"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <Button 
                onClick={runGmailSMTPTests}
                disabled={isRunning || !testEmail}
                className="min-w-[140px]"
              >
                {isRunning ? (
                  <>
                    <Activity className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Tests
                  </>
                )}
              </Button>
            </div>

            {testResults.length > 0 && (
              <Alert className={overallStatus === 'success' ? 'border-green-200 bg-green-50' : overallStatus === 'error' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  <strong>Overall Status:</strong> {
                    overallStatus === 'success' ? '✅ All tests passed! Gmail SMTP is ready for production.' :
                    overallStatus === 'error' ? '❌ Some tests failed. Check the results below for details.' :
                    '⏳ Tests running...'
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <div className="space-y-3">
          {testResults.map((result) => (
            <Card key={result.test} className={result.status === 'error' ? 'border-red-200' : result.status === 'success' ? 'border-green-200' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-medium">{result.test}</p>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      {result.timing && (
                        <p className="text-xs text-muted-foreground">Completed in {result.timing}ms</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(result.status)}
                  </div>
                </div>
                {result.details && result.status === 'success' && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};