import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Mail, Send, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SMTPHealthStatus {
  isHealthy: boolean;
  message: string;
  lastCheck: string;
  details?: {
    configSource: string;
    smtpConfigured: boolean;
    connectionTestPassed: boolean;
  };
}

export const SMTPHealthMonitor: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<SMTPHealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const checkSMTPHealth = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: { check: 'smtp' },
        headers: { 'Content-Type': 'application/json' }
      });

      if (error) throw error;

      setHealthStatus({
        isHealthy: data.success || false,
        message: data.message || 'Unknown status',
        lastCheck: new Date().toISOString(),
        details: data.details
      });

      if (data.success) {
        toast.success('SMTP connection is healthy');
      } else {
        toast.error(`SMTP issue: ${data.message}`);
      }
    } catch (error: any) {
      console.error('SMTP health check failed:', error);
      setHealthStatus({
        isHealthy: false,
        message: `Health check failed: ${error.message}`,
        lastCheck: new Date().toISOString()
      });
      toast.error('Failed to check SMTP health');
    } finally {
      setIsLoading(false);
    }
  };

  const processEmailQueue = async () => {
    setIsProcessingQueue(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-email-queue-processor', {
        body: { priority: 'all', limit: 50 },
        headers: { 'Content-Type': 'application/json' }
      });

      if (error) throw error;

      toast.success(`Processed ${data.processed || 0} emails (${data.success || 0} successful, ${data.failed || 0} failed)`);
    } catch (error: any) {
      console.error('Email queue processing failed:', error);
      toast.error('Failed to process email queue');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const testEmailDelivery = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: 'admin@test.com',
          subject: 'SMTP Test Email',
          htmlContent: '<h1>Test Email</h1><p>This is a test email to verify SMTP configuration.</p>',
          emailType: 'test'
        }
      });

      if (error) throw error;

      toast.success(`Test email sent successfully via ${data.provider}`);
    } catch (error: any) {
      console.error('Test email failed:', error);
      toast.error(`Test email failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SMTP Health Monitor
          </CardTitle>
          <CardDescription>
            Monitor and test your SMTP configuration and email delivery system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Health Status */}
          {healthStatus && (
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {healthStatus.isHealthy ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <Badge variant={healthStatus.isHealthy ? "default" : "destructive"}>
                  {healthStatus.isHealthy ? "Healthy" : "Issues Detected"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{healthStatus.message}</p>
              <p className="text-xs text-muted-foreground">
                Last checked: {new Date(healthStatus.lastCheck).toLocaleString()}
              </p>
              
              {healthStatus.details && (
                <div className="mt-3 space-y-1 text-sm">
                  <div>Config Source: <Badge variant="outline">{healthStatus.details.configSource}</Badge></div>
                  <div>SMTP Configured: <Badge variant={healthStatus.details.smtpConfigured ? "default" : "destructive"}>
                    {healthStatus.details.smtpConfigured ? "Yes" : "No"}
                  </Badge></div>
                  <div>Connection Test: <Badge variant={healthStatus.details.connectionTestPassed ? "default" : "destructive"}>
                    {healthStatus.details.connectionTestPassed ? "Passed" : "Failed"}
                  </Badge></div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={checkSMTPHealth} 
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Check SMTP Health
            </Button>
            
            <Button 
              onClick={processEmailQueue} 
              disabled={isProcessingQueue}
              variant="outline"
            >
              <Send className={`h-4 w-4 mr-2 ${isProcessingQueue ? 'animate-spin' : ''}`} />
              Process Email Queue
            </Button>
            
            <Button 
              onClick={testEmailDelivery} 
              disabled={isLoading}
              variant="outline"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Test Email
            </Button>
          </div>

          {/* Instructions */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">SMTP Configuration Status</h4>
            <div className="text-sm space-y-1">
              <p>✅ SMTP Function Secrets have been configured</p>
              <p>⚠️ Please verify your email provider credentials are correct</p>
              <p>⚠️ Check your email provider's authentication requirements</p>
              <p>📧 Test the connection before processing the email queue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};