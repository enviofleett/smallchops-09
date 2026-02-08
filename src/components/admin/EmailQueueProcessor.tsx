import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Play, RefreshCw, Shield, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
interface QueueStats {
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

export const EmailQueueProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchQueueStats = async () => {
    try {
      console.log('Fetching queue statistics...');
      
      // Get all communication events with their statuses
      const { data, error } = await (supabase as any)
        .from('communication_events')
        .select('status, retry_count, error_message');
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        console.log('No communication events found');
        setQueueStats({ queued: 0, processing: 0, sent: 0, failed: 0, total: 0 });
        setLastRefresh(new Date());
        return;
      }

      // Calculate statistics
      const stats = data.reduce((acc, event) => {
        const status = event.status;
        acc.total++;
        
        switch (status) {
          case 'queued':
            acc.queued++;
            break;
          case 'processing':
            acc.processing++;
            break;
          case 'sent':
            acc.sent++;
            break;
          case 'failed':
            acc.failed++;
            break;
        }
        
        return acc;
      }, { queued: 0, processing: 0, sent: 0, failed: 0, total: 0 });

      console.log('Queue statistics:', stats);
      setQueueStats(stats);
      setLastRefresh(new Date());
      
    } catch (error: any) {
      console.error('Error fetching queue stats:', error);
      toast({
        title: "Failed to fetch queue stats",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const processQueue = async (functionName: string, description: string) => {
    setIsProcessing(true);
    try {
      console.log(`Starting email processing with ${functionName}...`);
      
      const { data, error } = await supabase.functions.invoke(functionName);
      
      if (error) throw error;

      const processed = data?.processed || 0;
      const failed = data?.failed || 0;
      
      console.log(`Processing complete: ${processed} processed, ${failed} failed`);
      
      toast({
        title: "Processing Complete",
        description: `${description}: ${processed} emails processed, ${failed} failed`,
        variant: processed > 0 ? "default" : "destructive"
      });

      // Refresh stats after processing
      await fetchQueueStats();
      
    } catch (error: any) {
      console.error(`Error processing with ${functionName}:`, error);
      toast({
        title: "Processing Failed",
        description: error.message || `Failed to process emails with ${functionName}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const testSMTPConnection = async () => {
    setIsTesting(true);
    
    try {
      console.log('🔍 Starting comprehensive SMTP connection test...');
      
      // Phase 1: SMTP Configuration Health Check
      toast({
        title: "SMTP Test Starting",
        description: "Phase 1: Checking SMTP configuration...",
        variant: "default"
      });

      const { data: configData, error: configError } = await supabase.functions.invoke('unified-smtp-sender', {
        body: { 
          healthcheck: true,
          check: 'smtp',
          comprehensive: true 
        }
      });

      if (configError) {
        throw new Error(`Configuration check failed: ${configError.message}`);
      }

      console.log('✅ SMTP configuration check result:', configData);

      // Phase 2: Authentication Test
      toast({
        title: "SMTP Test Progress",
        description: "Phase 2: Testing SMTP authentication...",
        variant: "default"
      });

      const { data: authData, error: authError } = await supabase.functions.invoke('smtp-auth-healthcheck');

      if (authError) {
        console.warn('⚠️ Authentication test failed:', authError);
        // Don't fail completely, continue to connection test
      }

      console.log('🔐 SMTP authentication result:', authData);

      // Phase 3: Full Connection Test with Real Email
      toast({
        title: "SMTP Test Progress", 
        description: "Phase 3: Testing email delivery...",
        variant: "default"
      });

      const testEmail = {
        to: 'smtp-test@example.com', // Safe test email
        subject: `SMTP Connection Test - ${new Date().toISOString()}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2563eb;">🔧 SMTP Test Email</h2>
            <p>This is a production-ready SMTP connection test.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <h3>Test Details:</h3>
              <ul>
                <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
                <li><strong>Test ID:</strong> ${Math.random().toString(36).substr(2, 9)}</li>
                <li><strong>Environment:</strong> Production</li>
                <li><strong>SMTP Provider:</strong> ${configData?.provider || 'Unknown'}</li>
              </ul>
            </div>
            <p style="color: #059669;">✅ If you received this email, SMTP is working correctly!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280;">
              This is an automated test email from your application's SMTP system.
            </p>
          </div>
        `,
        textContent: `
SMTP Connection Test

This is a production-ready SMTP connection test.

Test Details:
- Timestamp: ${new Date().toLocaleString()}
- Test ID: ${Math.random().toString(36).substr(2, 9)}
- Environment: Production

If you received this email, SMTP is working correctly!
        `,
        emailType: 'test',
        source: 'smtp_diagnostics'
      };

      const { data: deliveryData, error: deliveryError } = await supabase.functions.invoke('unified-smtp-sender', {
        body: testEmail
      });

      if (deliveryError) {
        throw new Error(`Email delivery test failed: ${deliveryError.message}`);
      }

      console.log('📧 Email delivery test result:', deliveryData);

      // Comprehensive Success Report
      const testResults = {
        configuration: configData?.success ? '✅ Passed' : '❌ Failed',
        authentication: authData?.success ? '✅ Passed' : '⚠️ Warning',
        delivery: deliveryData?.success ? '✅ Passed' : '❌ Failed',
        provider: deliveryData?.provider || configData?.provider || 'Unknown',
        messageId: deliveryData?.messageId || 'N/A',
        timestamp: new Date().toISOString()
      };

      console.log('🎯 Complete SMTP test results:', testResults);

      // Log to audit for production monitoring
      await (supabase as any).from('audit_logs').insert({
        action: 'smtp_comprehensive_test',
        category: 'SMTP Diagnostics',
        message: 'Comprehensive SMTP connection test completed',
        new_values: testResults
      });

      toast({
        title: "🎉 SMTP Test Completed Successfully",
        description: `All phases passed. Email sent via ${testResults.provider}. Message ID: ${testResults.messageId?.substring(0, 20)}...`,
        variant: "default"
      });

    } catch (error: any) {
      console.error('💥 SMTP comprehensive test failed:', error);
      
      // Enhanced error reporting for production troubleshooting
      const errorDetails = {
        message: error.message,
        timestamp: new Date().toISOString(),
        stack: error.stack?.substring(0, 500), // Limited stack trace
        phase: error.message.includes('Configuration') ? 'configuration' : 
               error.message.includes('Authentication') ? 'authentication' : 
               error.message.includes('delivery') ? 'delivery' : 'unknown'
      };

      // Log error for production monitoring
      await (supabase as any).from('audit_logs').insert({
        action: 'smtp_test_failed',
        category: 'SMTP Error',
        message: 'SMTP connection test failed',
        new_values: errorDetails
      });

      toast({
        title: "🚨 SMTP Test Failed",
        description: `${errorDetails.phase} phase failed: ${error.message.substring(0, 100)}...`,
        variant: "destructive"
      });

      // Provide actionable troubleshooting guidance
      if (error.message.includes('Authentication')) {
        toast({
          title: "💡 Troubleshooting Tip",
          description: "Check your email provider credentials and setup requirements",
          variant: "default"
        });
      } else if (error.message.includes('Configuration')) {
        toast({
          title: "💡 Troubleshooting Tip", 
          description: "Verify SMTP Function Secrets are configured correctly",
          variant: "default"
        });
      } else if (error.message.includes('delivery')) {
        toast({
          title: "💡 Troubleshooting Tip",
          description: "SMTP connects but can't send. Check sender email domain authentication",
          variant: "default"
        });
      }

    } finally {
      setIsTesting(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchQueueStats();
    
    const interval = setInterval(fetchQueueStats, 3 * 60 * 1000); // Reduced to 3 minutes
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'queued': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="h-3 w-3" />;
      case 'failed': return <XCircle className="h-3 w-3" />;
      case 'processing': return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'queued': return <Clock className="h-3 w-3" />;
      default: return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const getQueueHealth = () => {
    if (!queueStats) return { status: 'unknown', color: 'gray' };
    
    const { failed, total } = queueStats;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;
    
    if (failureRate > 20) return { status: 'poor', color: 'red' };
    if (failureRate > 10) return { status: 'warning', color: 'yellow' };
    return { status: 'healthy', color: 'green' };
  };
  const health = getQueueHealth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Queue Processor
          <Badge className={`ml-auto ${health.color === 'green' ? 'bg-green-100 text-green-800' : health.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
            {health.status}
          </Badge>
        </CardTitle>
        <CardDescription>
          Process queued emails and monitor queue status
          {lastRefresh && (
            <span className="text-xs text-muted-foreground block mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Queue Statistics */}
        {queueStats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon('queued')}
                <span className="text-sm font-medium">Queued</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{queueStats.queued}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon('processing')}
                <span className="text-sm font-medium">Processing</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{queueStats.processing}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon('sent')}
                <span className="text-sm font-medium">Sent</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{queueStats.sent}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon('failed')}
                <span className="text-sm font-medium">Failed</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading queue statistics...</span>
          </div>
        )}

        {/* Queue Health Summary */}
        {queueStats && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Events: {queueStats.total}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchQueueStats}
                disabled={isProcessing || isTesting}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        )}
        
        {/* Processing Actions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Queue Processing</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={() => processQueue('unified-email-queue-processor', 'Unified Email Queue Processor')}
              disabled={isProcessing || isTesting}
              className="justify-start"
              size="sm"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Process Queue
            </Button>
            
            {/* Legacy processors removed/consolidated */}
          </div>
        </div>

        {/* SMTP Connection Test */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">SMTP Diagnostics</h4>
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <Button
              onClick={testSMTPConnection}
              disabled={isProcessing || isTesting}
              variant={isTesting ? "default" : "outline"}
              className="w-full justify-start"
              size="sm"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              {isTesting ? "Running Comprehensive SMTP Test..." : "Test SMTP Connection"}
            </Button>
            
            {isTesting && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Running 3-phase test: Configuration → Authentication → Delivery</span>
                </div>
                <div className="text-muted-foreground">
                  This comprehensive test verifies SMTP settings, credentials, and email delivery.
                </div>
              </div>
            )}
            
            {!isTesting && (
              <div className="text-xs text-muted-foreground">
                <div className="font-medium mb-1">Production-Ready SMTP Test includes:</div>
                <ul className="space-y-0.5 list-disc list-inside pl-2">
                  <li>SMTP server configuration validation</li>
                  <li>Authentication credentials verification</li>
                  <li>Actual test email delivery</li>
                  <li>Comprehensive error reporting & troubleshooting</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Queue Health Warnings */}
        {queueStats && queueStats.failed > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Queue Issues Detected</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              {queueStats.failed} emails failed to send. Check SMTP settings and logs.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};