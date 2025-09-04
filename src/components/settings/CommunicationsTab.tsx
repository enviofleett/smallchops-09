import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmailTemplateManager } from '@/components/admin/EmailTemplateManager';
import { SMTPSettingsTab } from './SMTPSettingsTab';
import { RealTimeEmailProcessor } from './RealTimeEmailProcessor';
import { EmailDeliveryMonitor } from './EmailDeliveryMonitor';
import { UnifiedEmailControls } from './UnifiedEmailControls';
import { EmailStatusDashboard } from '@/components/admin/EmailStatusDashboard';
import { useEmailService } from '@/hooks/useEmailService';
import { useSMTPSettings } from '@/hooks/useSMTPSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Settings, FileText, TestTube, Activity, BarChart3, AlertCircle, CheckCircle, Clock, Send, TrendingUp, User, Zap, Shield, Key } from 'lucide-react';
import { DeliverySchedulingTab } from './DeliverySchedulingTab';
import { LegalTermsManager } from './LegalTermsManager';
import { SMTPIntegrationDiagnostics } from './SMTPIntegrationDiagnostics';
import { SMTPConfigurationGuide } from './SMTPConfigurationGuide';
interface EmailStats {
  totalSent: number;
  deliveredToday: number;
  failedToday: number;
  deliveryRate: number;
  recentActivity: Array<{
    id: string;
    status: string;
    recipient: string;
    subject: string;
    timestamp: string;
  }>;
}
export const CommunicationsTab = () => {
  const [testEmail, setTestEmail] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [productionStatus, setProductionStatus] = useState<{
    configured: boolean;
    source: string;
    message: string;
  } | null>(null);
  
  const {
    deliveryLogs,
    isLoadingLogs
  } = useEmailService();
  const {
    settings: smtpSettings,
    isLoading: isLoadingSettings
  } = useSMTPSettings();

  // Check production credentials status with proper error handling
  React.useEffect(() => {
    const checkProductionStatus = async () => {
      try {
        // Production-safe health check with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
          body: {
            healthcheck: true,
            check: 'smtp'
          }
        });

        clearTimeout(timeoutId);

        if (error) {
          throw new Error(error.message || 'Health check failed');
        }

        if (data?.smtpCheck) {
          setProductionStatus({
            configured: data.smtpCheck.configured || false,
            source: data.smtpCheck.source || 'unknown',
            message: data.smtpCheck.configured 
              ? `Production ready! Using ${data.smtpCheck.source === 'function_secrets' ? 'Edge Function Secrets' : 'Database Configuration'}`
              : 'SMTP credentials not configured properly'
          });
        } else {
          // Fallback for malformed response
          setProductionStatus({
            configured: false,
            source: 'unknown',
            message: 'SMTP health check returned invalid response'
          });
        }
      } catch (error: any) {
        console.warn('Failed to check production status:', error);
        
        // Production-safe error categorization
        let message = 'Unable to verify production configuration';
        if (error.name === 'AbortError') {
          message = 'Health check timed out - SMTP service may be unavailable';
        } else if (error.message?.includes('SMTP_PASSWORD')) {
          message = 'SMTP credentials missing - please configure Function Secrets';
        }
        
        setProductionStatus({
          configured: false,
          source: 'error',
          message
        });
      }
    };

    // Debounce health check to prevent spam
    const timeoutId = setTimeout(checkProductionStatus, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Calculate email statistics
  React.useEffect(() => {
    if (deliveryLogs?.length) {
      const today = new Date().toDateString();
      const todayLogs = deliveryLogs.filter(log => new Date(log.created_at).toDateString() === today);
      const delivered = todayLogs.filter(log => log.delivery_status === 'delivered').length;
      const failed = todayLogs.filter(log => log.delivery_status === 'failed' || log.delivery_status === 'bounced').length;
      const total = todayLogs.length;
      setEmailStats({
        totalSent: deliveryLogs.length,
        deliveredToday: delivered,
        failedToday: failed,
        deliveryRate: total > 0 ? Math.round(delivered / total * 100) : 0,
        recentActivity: deliveryLogs.slice(0, 10).map(log => ({
          id: log.id,
          status: log.delivery_status,
          recipient: log.recipient_email,
          subject: log.subject || 'No subject',
          timestamp: log.created_at
        }))
      });
    }
  }, [deliveryLogs]);
  const testEmailConnection = async () => {
    // Production-ready input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!testEmail || !emailRegex.test(testEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    const sanitizedEmail = testEmail.trim().toLowerCase();
    setTestingConnection(true);
    setConnectionStatus(null);
    
    try {
      // Production-safe edge function call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: sanitizedEmail,
          templateKey: 'smtp_connection_test',
          variables: {
            timestamp: new Date().toLocaleString(),
            businessName: 'Starters Small Chops'
          }
        }
      });
      
      clearTimeout(timeoutId);
      
      if (error) {
        throw new Error(`SMTP Function Error: ${error.message || 'Unknown error'}`);
      }
      
      if (!data || !data.success) {
        throw new Error(data?.error || 'Email send failed - check SMTP configuration');
      }
      
      setConnectionStatus('success');
      toast.success('✅ Test email sent successfully! Check your inbox.');
    } catch (error: any) {
      console.error('Test email error:', error);
      setConnectionStatus('error');
      
      // Production-ready error categorization
      let errorMessage = 'Test failed - ';
      if (error.name === 'AbortError') {
        errorMessage += 'Request timed out. Check your SMTP configuration.';
      } else if (error.message?.includes('SMTP_PASSWORD')) {
        errorMessage += 'SMTP credentials not configured. Please add Function Secrets.';
      } else if (error.message?.includes('535')) {
        errorMessage += 'SMTP authentication failed. Verify your email credentials.';
      } else if (error.message?.includes('Edge Function')) {
        errorMessage += 'SMTP service unavailable. Please try again later.';
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setTestingConnection(false);
    }
  };
  const processEmailQueue = async () => {
    setProcessingQueue(true);
    
    try {
      // Production-safe queue processing with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
      
      const { data, error } = await supabase.functions.invoke('unified-email-queue-processor', {
        body: { 
          batchSize: Math.min(50, 100), // Limit batch size for safety
          priority: 'all'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (error) {
        throw new Error(`Queue Processor Error: ${error.message || 'Unknown error'}`);
      }
      
      const result = data as { processed?: number; failed?: number; success?: boolean; message?: string };
      
      if (result.success !== false) {
        const processed = result.processed || 0;
        const failed = result.failed || 0;
        toast.success(`✅ Queue processed: ${processed} emails sent, ${failed} failed`);
      } else {
        throw new Error(result.message || 'Queue processing returned failure status');
      }
    } catch (error: any) {
      console.error('Queue processing error:', error);
      
      // Production-ready error handling
      let errorMessage = 'Queue processing failed - ';
      if (error.name === 'AbortError') {
        errorMessage += 'Processing timed out. Large queue detected.';
      } else if (error.message?.includes('SMTP_PASSWORD')) {
        errorMessage += 'SMTP not configured. Please add Function Secrets.';
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setProcessingQueue(false);
    }
  };
  const StatCard = ({
    title,
    value,
    icon: Icon,
    trend,
    color = 'default'
  }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: string;
    color?: 'default' | 'success' | 'warning' | 'error';
  }) => <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color === 'success' ? 'text-green-600' : color === 'warning' ? 'text-yellow-600' : color === 'error' ? 'text-red-600' : ''}`}>
              {value}
            </p>
            {trend && <p className="text-xs text-muted-foreground flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                {trend}
              </p>}
          </div>
          <Icon className={`h-8 w-8 ${color === 'success' ? 'text-green-600' : color === 'warning' ? 'text-yellow-600' : color === 'error' ? 'text-red-600' : 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>;
  return <div className="space-y-6">
      {/* QA Email Integration Diagnostics */}
      <SMTPIntegrationDiagnostics />
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Email Management</h3>
          <p className="text-sm text-muted-foreground">
            Complete email system management - SMTP settings, templates, analytics, and testing
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Production Status Indicator */}
          {productionStatus && (
            <Badge 
              variant={productionStatus.configured ? "default" : "destructive"}
              className="flex items-center gap-1"
            >
              {productionStatus.configured ? (
                <Shield className="h-3 w-3" />
              ) : (
                <Key className="h-3 w-3" />
              )}
              {productionStatus.source === 'function_secrets' ? 'Production Ready' : 
               productionStatus.configured ? 'Database Config' : 'Setup Required'}
            </Badge>
          )}
          {productionStatus && !productionStatus.configured && (
            <Button 
              onClick={processEmailQueue} 
              disabled={processingQueue || (productionStatus && !productionStatus.configured)} 
              variant="outline"
              title={productionStatus && !productionStatus.configured ? 'Configure Function Secrets to enable queue processing in production' : ''}
            >
              <Send className="mr-2 h-4 w-4" />
              {processingQueue ? 'Processing...' : 'Process Queue'}
            </Button>
          )}
          {productionStatus?.configured && (
            <Button onClick={processEmailQueue} disabled={processingQueue} variant="outline">
              <Send className="mr-2 h-4 w-4" />
              {processingQueue ? 'Processing...' : 'Process Queue'}
            </Button>
          )}
        </div>
      </div>

      {/* Production Configuration Alert */}
      {productionStatus && !productionStatus.configured && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Production Setup Required:</strong> Configure SMTP credentials in Edge Function Secrets for production use. 
            {' '}
            <a 
              href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Add Function Secrets →
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Production Success Status */}
      {productionStatus?.configured && productionStatus.source === 'function_secrets' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Production Ready:</strong> SMTP credentials configured in Edge Function Secrets. Your email system is ready for production deployment.
          </AlertDescription>
        </Alert>
      )}

      {/* Email Statistics */}
      {emailStats && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Emails Sent" value={emailStats.totalSent} icon={Mail} trend="All time" />
          <StatCard title="Delivered Today" value={emailStats.deliveredToday} icon={CheckCircle} color="success" trend="Today" />
          <StatCard title="Failed Today" value={emailStats.failedToday} icon={AlertCircle} color={emailStats.failedToday > 0 ? 'error' : 'default'} trend="Today" />
          <StatCard title="Delivery Rate" value={`${emailStats.deliveryRate}%`} icon={BarChart3} color={emailStats.deliveryRate >= 95 ? 'success' : emailStats.deliveryRate >= 85 ? 'warning' : 'error'} trend="Today" />
        </div>}

      <Tabs defaultValue="unified" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="unified" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Unified System
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            SMTP Settings
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Testing & Preview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Delivery Monitoring
          </TabsTrigger>
          <TabsTrigger value="delivery-scheduling" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Delivery Scheduling
          </TabsTrigger>
          <TabsTrigger value="legal-terms" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Legal & Terms
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unified" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <UnifiedEmailControls />
            </div>
            <div>
              <EmailStatusDashboard />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <SMTPConfigurationGuide />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <EmailTemplateManager />
        </TabsContent>

        <TabsContent value="processing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Real-Time Email Processing
                </CardTitle>
                <CardDescription>
                  Monitor and process email queue in real-time for instant delivery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RealTimeEmailProcessor />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Enhanced Queue Management
                </CardTitle>
                <CardDescription>
                  Advanced email processing with retry mechanisms and error handling
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Enhanced processing includes automatic retry for failed emails,
                  rate limiting, and comprehensive error handling for production use.
                </div>
                <Button onClick={processEmailQueue} disabled={processingQueue} className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  {processingQueue ? 'Processing Enhanced Queue...' : 'Process Enhanced Queue'}
                </Button>
                
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Production Ready Features</span>
                  </div>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>✓ Automatic retry for failed emails</p>
                    <p>✓ Rate limiting to prevent spam</p>
                    <p>✓ Comprehensive error logging</p>
                    <p>✓ Real-time status monitoring</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Test SMTP Connection
                </CardTitle>
                <CardDescription>
                  Send a test email to verify your SMTP configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-email">Test Email Address</Label>
                  <Input id="test-email" type="email" placeholder="your-email@example.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                </div>
                <Button onClick={testEmailConnection} disabled={testingConnection || (productionStatus && !productionStatus.configured)} className="w-full">
                  <TestTube className="mr-2 h-4 w-4" />
                  {testingConnection ? 'Sending Test Email...' : 'Send Test Email'}
                </Button>

                {connectionStatus && (
                  <Alert className={connectionStatus === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    {connectionStatus === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className={connectionStatus === 'success' ? 'text-green-800' : 'text-red-800'}>
                      {connectionStatus === 'success' 
                        ? 'Test email sent successfully! Check your inbox and spam folder.'
                        : 'Test email failed. Please verify your SMTP credentials and configuration.'
                      }
                      {connectionStatus === 'error' && (
                        <div className="mt-2 text-sm">
                          <p className="font-medium">Troubleshooting:</p>
                          <ul className="list-disc list-inside space-y-1 mt-1">
                            <li>Check that SMTP Function Secrets are configured correctly</li>
                            <li>Verify your email provider credentials and app passwords</li>
                            <li>Ensure your email provider allows SMTP connections</li>
                          </ul>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Quick Email Processing
                </CardTitle>
                <CardDescription>
                  Instant processing for testing and manual queue management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Process queued email events immediately. For production use, 
                  go to the "Email Processing" tab for advanced controls.
                </div>
                <Button onClick={processEmailQueue} disabled={processingQueue || (productionStatus && !productionStatus.configured)} className="w-full" variant="outline">
                  <Send className="mr-2 h-4 w-4" />
                  {processingQueue ? 'Processing Queue...' : 'Quick Process Queue'}
                </Button>
                <div className="text-xs text-muted-foreground">
                  💡 Use the Email Processing tab for real-time monitoring and enhanced features
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Live Email Delivery Monitoring
              </CardTitle>
              <CardDescription>
                Real-time delivery analytics, health monitoring, and comprehensive email system metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailDeliveryMonitor />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery-scheduling" className="space-y-4">
          <DeliverySchedulingTab />
        </TabsContent>

        <TabsContent value="legal-terms" className="space-y-4">
          <LegalTermsManager />
        </TabsContent>
      </Tabs>
    </div>;
};