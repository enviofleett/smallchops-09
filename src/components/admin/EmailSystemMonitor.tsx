import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Send,
  Zap
} from 'lucide-react';

interface EmailHealth {
  status: string;
  queued_emails: number;
  failed_last_hour: number;
  sent_today: number;
  smtp_configured: boolean;
  timestamp: string;
}

export const EmailSystemMonitor = () => {
  const [emailHealth, setEmailHealth] = useState<EmailHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const fetchEmailHealth = async () => {
    try {
      // Fetch email health data from communication_events table
      const [queuedResult, failedResult, sentResult] = await Promise.all([
        (supabase as any)
          .from('communication_events')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'queued'),
        (supabase as any)
          .from('communication_events')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()),
        (supabase as any)
          .from('communication_events')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'sent')
          .gte('sent_at', new Date().toISOString().split('T')[0])
      ]);

      // Check SMTP configuration
      const { data: smtpConfig } = await (supabase as any)
        .from('communication_settings')
        .select('use_smtp')
        .eq('use_smtp', true)
        .limit(1)
        .maybeSingle();

      const healthData: EmailHealth = {
        status: 'healthy',
        queued_emails: queuedResult.count || 0,
        failed_last_hour: failedResult.count || 0,
        sent_today: sentResult.count || 0,
        smtp_configured: !!smtpConfig,
        timestamp: new Date().toISOString()
      };

      // Determine health status
      if ((healthData.failed_last_hour || 0) > 10 || (healthData.queued_emails || 0) > 50) {
        healthData.status = 'degraded';
      }
      if (!healthData.smtp_configured) {
        healthData.status = 'smtp_config_error';
      }
      
      setEmailHealth(healthData);
    } catch (error) {
      console.error('Error fetching email health:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch email system health',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processHighPriorityEmails = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-email-queue-processor');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: 'Email Processing Triggered',
        description: `Processed ${data.successful || 0} emails successfully`,
      });
      
      // Refresh health status
      await fetchEmailHealth();
    } catch (error) {
      console.error('Error processing emails:', error);
      toast({
        title: 'Processing Failed',
        description: 'Failed to process high priority emails',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processWelcomeEmails = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('instant-welcome-processor');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: 'Welcome Emails Processed',
        description: `Processed ${data.successful || 0} welcome emails`,
      });
      
      await fetchEmailHealth();
    } catch (error) {
      console.error('Error processing welcome emails:', error);
      toast({
        title: 'Processing Failed',
        description: 'Failed to process welcome emails',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchEmailHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchEmailHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'smtp_config_error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'smtp_config_error':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email System Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading email system status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email System Monitor
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEmailHealth}
              disabled={isLoading}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {emailHealth && (
            <div className="space-y-6">
              {/* System Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">System Status</h3>
                  <Badge 
                    variant="secondary" 
                    className={`${getStatusColor(emailHealth.status)} flex items-center gap-1`}
                  >
                    {getStatusIcon(emailHealth.status)}
                    {emailHealth.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last updated: {new Date(emailHealth.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* Email Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <div>
                        <div className="text-2xl font-bold">{emailHealth.queued_emails}</div>
                        <div className="text-sm text-muted-foreground">Queued Emails</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="text-2xl font-bold">{emailHealth.sent_today}</div>
                        <div className="text-sm text-muted-foreground">Sent Today</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <div>
                        <div className="text-2xl font-bold">{emailHealth.failed_last_hour}</div>
                        <div className="text-sm text-muted-foreground">Failed (Last Hour)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="text-2xl font-bold">
                          {emailHealth.smtp_configured ? 'ON' : 'OFF'}
                        </div>
                        <div className="text-sm text-muted-foreground">SMTP Config</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={processHighPriorityEmails}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  {isProcessing ? 'Processing...' : 'Process High Priority'}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={processWelcomeEmails}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Process Welcome Emails
                </Button>
              </div>

              {/* Alerts */}
              {emailHealth.queued_emails > 50 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium text-yellow-800">High Queue Volume</span>
                  </div>
                  <p className="text-yellow-700 mt-1">
                    There are {emailHealth.queued_emails} emails in the queue. Consider processing them manually.
                  </p>
                </div>
              )}

              {emailHealth.failed_last_hour > 10 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-800">High Failure Rate</span>
                  </div>
                  <p className="text-red-700 mt-1">
                    {emailHealth.failed_last_hour} emails failed in the last hour. Check SMTP configuration.
                  </p>
                </div>
              )}

              {!emailHealth.smtp_configured && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-800">SMTP Not Configured</span>
                  </div>
                  <p className="text-red-700 mt-1">
                    SMTP is not properly configured. Please check your email settings.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};