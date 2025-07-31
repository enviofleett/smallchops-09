import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useEmailService } from '@/hooks/useEmailService';
import { useEmailMonitoring } from '@/hooks/useEmailMonitoring';
import { useSMTPSettings } from '@/hooks/useSMTPSettings';
import { toast } from 'sonner';
import { 
  Mail, 
  Send, 
  Settings, 
  FileText, 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  Clock,
  Users,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export const EmailManagementDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [testEmail, setTestEmail] = useState('');

  const { 
    sendEmailAsync, 
    templates, 
    deliveryLogs, 
    isLoadingTemplates, 
    isLoadingLogs,
    isSending 
  } = useEmailService();

  const { 
    metrics, 
    isLoading: metricsLoading, 
    refreshMetrics 
  } = useEmailMonitoring();

  const {
    settings,
    isLoading: settingsLoading,
    saveSettings,
    isSaving,
    testConnection,
    isTesting
  } = useSMTPSettings();

  const [localSettings, setLocalSettings] = useState({
    smtp_host: 'mail.enviofleet.com',
    smtp_port: 587,
    smtp_user: 'support@enviofleet.com',
    smtp_pass: '',
    smtp_secure: true,
    sender_name: 'Starters',
    sender_email: 'support@enviofleet.com',
    use_smtp: true,
    email_provider: 'smtp'
  });

  // Update local settings when remote settings load
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_user: settings.smtp_user,
        smtp_pass: settings.smtp_pass,
        smtp_secure: settings.smtp_secure,
        sender_name: settings.sender_name || 'Starters',
        sender_email: settings.sender_email,
        use_smtp: settings.use_smtp,
        email_provider: settings.email_provider || 'smtp'
      });
    }
  }, [settings]);

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    try {
      await testConnection(testEmail);
      setTestEmail('');
    } catch (error) {
      console.error('Test email error:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await saveSettings(localSettings);
    } catch (error) {
      console.error('Save settings error:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
      case 'bounced':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'bounced':
        return 'bg-red-100 text-red-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Management</h1>
          <p className="text-muted-foreground">
            Configure SMTP settings, manage templates, and monitor email delivery
          </p>
        </div>
        <Button onClick={() => refreshMetrics()} variant="outline">
          <BarChart3 className="mr-2 h-4 w-4" />
          Refresh Metrics
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">SMTP Settings</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="delivery">Delivery Logs</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metricsLoading ? '...' : metrics?.totalSent || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  +20.1% from last month
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metricsLoading ? '...' : `${metrics?.deliveryRate || 0}%`}
                </div>
                <p className="text-xs text-muted-foreground">
                  +2.1% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed Emails</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metricsLoading ? '...' : metrics?.totalBounced || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  -5.2% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Health Score</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metricsLoading ? '...' : `${metrics?.healthScore || 0}/100`}
                </div>
                <p className="text-xs text-muted-foreground">
                  Overall email health
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Test</CardTitle>
              <CardDescription>
                Send a test email to verify your SMTP configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter test email address"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  type="email"
                  className="flex-1"
                />
                <Button 
                  onClick={handleTestEmail} 
                  disabled={isTesting || !testEmail}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isTesting ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMTP Configuration</CardTitle>
              <CardDescription>
                Configure your SMTP server settings for email delivery
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="text-center py-8">Loading settings...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">SMTP Host</Label>
                      <Input
                        id="smtp-host"
                        value={localSettings.smtp_host}
                        onChange={(e) => setLocalSettings({...localSettings, smtp_host: e.target.value})}
                        placeholder="mail.yourdomain.com"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">SMTP Port</Label>
                      <Select 
                        value={localSettings.smtp_port.toString()} 
                        onValueChange={(value) => setLocalSettings({...localSettings, smtp_port: parseInt(value)})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 (Plain)</SelectItem>
                          <SelectItem value="587">587 (TLS)</SelectItem>
                          <SelectItem value="465">465 (SSL)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtp-username">Username</Label>
                      <Input
                        id="smtp-username"
                        value={localSettings.smtp_user}
                        onChange={(e) => setLocalSettings({...localSettings, smtp_user: e.target.value})}
                        placeholder="your-username"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtp-password">Password</Label>
                      <Input
                        id="smtp-password"
                        type="password"
                        value={localSettings.smtp_pass}
                        onChange={(e) => setLocalSettings({...localSettings, smtp_pass: e.target.value})}
                        placeholder="your-password"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sender-name">Sender Name</Label>
                      <Input
                        id="sender-name"
                        value={localSettings.sender_name}
                        onChange={(e) => setLocalSettings({...localSettings, sender_name: e.target.value})}
                        placeholder="Your Business Name"
                      />
                    </div>

                     <div className="space-y-2">
                       <Label htmlFor="sender-email">Sender Email</Label>
                       <Input
                         id="sender-email"
                         type="email"
                         value={localSettings.sender_email}
                         onChange={(e) => setLocalSettings({...localSettings, sender_email: e.target.value})}
                         placeholder="noreply@yourdomain.com"
                       />
                     </div>
                   </div>

                   <div className="flex items-center justify-between space-x-4">
                     <div className="flex items-center space-x-2">
                       <Switch
                         id="smtp-secure"
                         checked={localSettings.smtp_secure}
                         onCheckedChange={(checked) => setLocalSettings({...localSettings, smtp_secure: checked})}
                       />
                       <Label htmlFor="smtp-secure">Use Secure Connection (TLS/SSL)</Label>
                     </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="use-smtp"
                          checked={localSettings.use_smtp}
                          onCheckedChange={(checked) => setLocalSettings({...localSettings, use_smtp: checked})}
                        />
                        <Label htmlFor="use-smtp">Enable SMTP Service</Label>
                      </div>
                   </div>

                  <Button 
                    className="w-full" 
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save SMTP Settings'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>
                Manage your email templates for different types of communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTemplates ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No templates found. Templates will be created automatically.
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{template.template_name}</h3>
                          <p className="text-sm text-muted-foreground">{template.template_key}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={template.is_active ? "default" : "secondary"}>
                            {template.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <FileText className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm mt-2">{template.subject_template}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Delivery Logs</CardTitle>
              <CardDescription>
                Monitor the status of recent email deliveries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="text-center py-8">Loading delivery logs...</div>
              ) : deliveryLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No delivery logs found
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {deliveryLogs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(log.delivery_status)}
                            <div>
                              <p className="font-medium">{log.recipient_email}</p>
                              <p className="text-sm text-muted-foreground">{log.subject}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(log.delivery_status)}>
                              {log.delivery_status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Analytics</CardTitle>
              <CardDescription>
                Detailed analytics and performance metrics for your email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Advanced analytics dashboard coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};