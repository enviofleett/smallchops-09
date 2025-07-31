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
import { useEmailService } from '@/hooks/useEmailService';
import { useSMTPSettings } from '@/hooks/useSMTPSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Mail, 
  Settings, 
  FileText, 
  TestTube,
  Activity,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  TrendingUp,
  User
} from 'lucide-react';

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
  
  const { deliveryLogs, isLoadingLogs } = useEmailService();
  const { settings: smtpSettings, isLoading: isLoadingSettings } = useSMTPSettings();

  // Calculate email statistics
  React.useEffect(() => {
    if (deliveryLogs?.length) {
      const today = new Date().toDateString();
      const todayLogs = deliveryLogs.filter(log => 
        new Date(log.created_at).toDateString() === today
      );
      
      const delivered = todayLogs.filter(log => log.delivery_status === 'delivered').length;
      const failed = todayLogs.filter(log => log.delivery_status === 'failed' || log.delivery_status === 'bounced').length;
      const total = todayLogs.length;
      
      setEmailStats({
        totalSent: deliveryLogs.length,
        deliveredToday: delivered,
        failedToday: failed,
        deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
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
    if (!testEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
        body: {
          to: testEmail,
          subject: 'SMTP Connection Test - ' + new Date().toISOString(),
          html: `
            <h2>SMTP Connection Test</h2>
            <p>This is a test email to verify your SMTP configuration is working correctly.</p>
            <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
            <p>If you received this email, your SMTP settings are configured properly.</p>
          `,
          text: `SMTP Connection Test - Sent at ${new Date().toLocaleString()}`
        }
      });

      if (error) {
        throw error;
      }

      setConnectionStatus('success');
      toast.success('Test email sent successfully!');
    } catch (error: any) {
      console.error('Test email error:', error);
      setConnectionStatus('error');
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const processEmailQueue = async () => {
    setProcessingQueue(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-communication-events');
      
      if (error) {
        throw error;
      }

      toast.success(`Processed ${data.processed || 0} emails, ${data.failed || 0} failed`);
    } catch (error: any) {
      console.error('Queue processing error:', error);
      toast.error(`Queue processing failed: ${error.message}`);
    } finally {
      setProcessingQueue(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, trend, color = 'default' }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: string;
    color?: 'default' | 'success' | 'warning' | 'error';
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${
              color === 'success' ? 'text-green-600' :
              color === 'warning' ? 'text-yellow-600' :
              color === 'error' ? 'text-red-600' : ''
            }`}>
              {value}
            </p>
            {trend && (
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                {trend}
              </p>
            )}
          </div>
          <Icon className={`h-8 w-8 ${
            color === 'success' ? 'text-green-600' :
            color === 'warning' ? 'text-yellow-600' :
            color === 'error' ? 'text-red-600' : 'text-muted-foreground'
          }`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Email Management</h3>
          <p className="text-sm text-muted-foreground">
            Complete email system management - SMTP settings, templates, analytics, and testing
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={processEmailQueue}
            disabled={processingQueue}
            variant="outline"
          >
            <Send className="mr-2 h-4 w-4" />
            {processingQueue ? 'Processing...' : 'Process Queue'}
          </Button>
        </div>
      </div>

      {/* Email Statistics */}
      {emailStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Emails Sent"
            value={emailStats.totalSent}
            icon={Mail}
            trend="All time"
          />
          <StatCard
            title="Delivered Today"
            value={emailStats.deliveredToday}
            icon={CheckCircle}
            color="success"
            trend="Today"
          />
          <StatCard
            title="Failed Today"
            value={emailStats.failedToday}
            icon={AlertCircle}
            color={emailStats.failedToday > 0 ? 'error' : 'default'}
            trend="Today"
          />
          <StatCard
            title="Delivery Rate"
            value={`${emailStats.deliveryRate}%`}
            icon={BarChart3}
            color={emailStats.deliveryRate >= 95 ? 'success' : emailStats.deliveryRate >= 85 ? 'warning' : 'error'}
            trend="Today"
          />
        </div>
      )}

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
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
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                SMTP Configuration
              </CardTitle>
              <CardDescription>
                Configure your SMTP server settings for sending emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SMTPSettingsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <EmailTemplateManager />
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
                  disabled={testingConnection || !testEmail}
                  className="w-full"
                >
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
                        ? 'Test email sent successfully! Check your inbox.'
                        : 'Test email failed. Please check your SMTP settings.'
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Email Queue Management
                </CardTitle>
                <CardDescription>
                  Process pending emails in the communication queue
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Process queued email events including order confirmations, 
                  status updates, and notifications.
                </div>
                <Button 
                  onClick={processEmailQueue}
                  disabled={processingQueue}
                  className="w-full"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {processingQueue ? 'Processing Queue...' : 'Process Email Queue'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Email Activity
                </CardTitle>
                <CardDescription>
                  Latest email delivery status and activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {isLoadingLogs ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading email activity...
                      </div>
                    ) : emailStats?.recentActivity?.length ? (
                      emailStats.recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg">
                          <div className={`mt-1 rounded-full p-1 ${
                            activity.status === 'delivered' ? 'bg-green-100 text-green-600' :
                            activity.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                            activity.status === 'failed' ? 'bg-red-100 text-red-600' :
                            'bg-yellow-100 text-yellow-600'
                          }`}>
                            {activity.status === 'delivered' ? <CheckCircle className="h-3 w-3" /> :
                             activity.status === 'sent' ? <Send className="h-3 w-3" /> :
                             activity.status === 'failed' ? <AlertCircle className="h-3 w-3" /> :
                             <Clock className="h-3 w-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm font-medium truncate">
                                {activity.recipient}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {activity.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {activity.subject}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No email activity found
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Email Performance
                </CardTitle>
                <CardDescription>
                  Key metrics and delivery statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">SMTP Status</span>
                    <Badge variant={smtpSettings?.use_smtp ? 'default' : 'destructive'}>
                      {isLoadingSettings ? 'Loading...' : smtpSettings?.use_smtp ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Server</span>
                    <span className="text-sm text-muted-foreground">
                      {smtpSettings?.smtp_host || 'Not configured'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Port</span>
                    <span className="text-sm text-muted-foreground">
                      {smtpSettings?.smtp_port || 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Encryption</span>
                    <Badge variant="outline">
                      {smtpSettings?.smtp_secure ? 'TLS/SSL' : 'None'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};