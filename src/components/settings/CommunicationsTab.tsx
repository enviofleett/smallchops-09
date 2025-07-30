import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Mail, Send, Settings, TestTube, ExternalLink, Shield, Server } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SMTPSettingsTab } from './SMTPSettingsTab';

const communicationSchema = z.object({
  enable_email: z.boolean().default(false),
  enable_sms: z.boolean().default(false),
  sender_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  smtp_user: z.string().min(1, 'Sender name is required').optional().or(z.literal('')),
  mailersend_api_token: z.string().optional(),
  mailersend_domain: z.string().optional(),
  mailersend_domain_verified: z.boolean().default(false),
  smtp_host: z.string().optional(),
  smtp_port: z.number().optional(),
  smtp_pass: z.string().optional(),
  sms_provider: z.string().optional(),
  sms_sender_id: z.string().optional(),
  sms_api_key: z.string().optional(),
});

type CommunicationFormData = z.infer<typeof communicationSchema>;

interface EmailTemplate {
  status: string;
  subject: string;
  html_content: string;
  variables: string[];
}

const defaultTemplates: EmailTemplate[] = [
  {
    status: 'pending',
    subject: 'Order Confirmation - #{order_number}',
    html_content: `<h2>Thank you for your order!</h2>
<p>Dear {customer_name},</p>
<p>We've received your order <strong>#{order_number}</strong> and it's being processed.</p>
<p>Order Total: <strong>{total_amount}</strong></p>
<p>We'll keep you updated on your order status.</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number', 'total_amount']
  },
  {
    status: 'confirmed',
    subject: 'Order Confirmed - #{order_number}',
    html_content: `<h2>Your order has been confirmed!</h2>
<p>Dear {customer_name},</p>
<p>Great news! Your order <strong>#{order_number}</strong> has been confirmed and is now being prepared.</p>
<p>Estimated preparation time: 15-30 minutes</p>
<p>We'll notify you when your order is ready.</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number']
  },
  {
    status: 'preparing',
    subject: 'Order Being Prepared - #{order_number}',
    html_content: `<h2>Your order is being prepared!</h2>
<p>Dear {customer_name},</p>
<p>Our kitchen team is now preparing your order <strong>#{order_number}</strong>.</p>
<p>We'll notify you as soon as it's ready for pickup or delivery.</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number']
  },
  {
    status: 'ready_for_pickup',
    subject: 'Order Ready for Pickup - #{order_number}',
    html_content: `<h2>Your order is ready for pickup!</h2>
<p>Dear {customer_name},</p>
<p>Your order <strong>#{order_number}</strong> is ready for pickup.</p>
<p>Please collect your order at your earliest convenience.</p>
<p>Location: {pickup_address}</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number', 'pickup_address']
  },
  {
    status: 'ready_for_delivery',
    subject: 'Order Ready for Delivery - #{order_number}',
    html_content: `<h2>Your order is ready for delivery!</h2>
<p>Dear {customer_name},</p>
<p>Your order <strong>#{order_number}</strong> is ready and will be delivered shortly.</p>
<p>Delivery Address: {delivery_address}</p>
<p>We'll notify you when the delivery is on its way.</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number', 'delivery_address']
  },
  {
    status: 'out_for_delivery',
    subject: 'Order Out for Delivery - #{order_number}',
    html_content: `<h2>Your order is out for delivery!</h2>
<p>Dear {customer_name},</p>
<p>Your order <strong>#{order_number}</strong> is now out for delivery.</p>
<p>Expected delivery time: 15-30 minutes</p>
<p>Delivery Address: {delivery_address}</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number', 'delivery_address']
  },
  {
    status: 'delivered',
    subject: 'Order Delivered - #{order_number}',
    html_content: `<h2>Your order has been delivered!</h2>
<p>Dear {customer_name},</p>
<p>Your order <strong>#{order_number}</strong> has been successfully delivered.</p>
<p>We hope you enjoy your meal!</p>
<p>Thank you for choosing us. We look forward to serving you again.</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number']
  },
  {
    status: 'cancelled',
    subject: 'Order Cancelled - #{order_number}',
    html_content: `<h2>Order Cancelled</h2>
<p>Dear {customer_name},</p>
<p>We regret to inform you that your order <strong>#{order_number}</strong> has been cancelled.</p>
<p>If payment was processed, a refund will be issued within 3-5 business days.</p>
<p>We apologize for any inconvenience caused.</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number']
  }
];

export const CommunicationsTab = () => {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(defaultTemplates[0]);
  const { toast } = useToast();

  const form = useForm<CommunicationFormData>({
    resolver: zodResolver(communicationSchema),
    defaultValues: {
      enable_email: false,
      enable_sms: false,
      sender_email: '',
      smtp_user: '',
      mailersend_api_token: '',
      mailersend_domain: '',
      mailersend_domain_verified: false,
      smtp_host: '',
      smtp_port: 587,
      smtp_pass: '',
      sms_provider: '',
      sms_sender_id: '',
      sms_api_key: '',
    },
  });

  useEffect(() => {
    loadCommunicationSettings();
  }, []);

  const loadCommunicationSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        form.reset({
          enable_email: data.enable_email || false,
          enable_sms: data.enable_sms || false,
          sender_email: data.sender_email || '',
          smtp_user: data.smtp_user || '',
          mailersend_api_token: data.mailersend_api_token || '',
          mailersend_domain: data.mailersend_domain || '',
          mailersend_domain_verified: data.mailersend_domain_verified || false,
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || 587,
          smtp_pass: data.smtp_pass || '',
          sms_provider: data.sms_provider || '',
          sms_sender_id: data.sms_sender_id || '',
          sms_api_key: data.sms_api_key || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading communication settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load communication settings',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: CommunicationFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('business-settings', {
        body: {
          action: 'update_communication_settings',
          settings: {
            enable_email: data.enable_email,
            enable_sms: data.enable_sms,
            // Convert empty strings to null for database
            sender_email: data.sender_email || null,
            smtp_user: data.smtp_user || null,
            mailersend_api_token: data.mailersend_api_token || null,
            mailersend_domain: data.mailersend_domain || null,
            mailersend_domain_verified: data.mailersend_domain_verified || false,
            smtp_host: data.smtp_host || null,
            smtp_port: data.smtp_port || null,
            smtp_pass: data.smtp_pass || null,
            sms_provider: data.sms_provider || null,
            sms_sender_id: data.sms_sender_id || null,
            sms_api_key: data.sms_api_key || null,
          }
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Settings Saved',
        description: 'Communication settings have been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error saving communication settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save communication settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const testEmailConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    
    try {
      const formData = form.getValues();
      
      if (!formData.sender_email) {
        throw new Error('Please enter a sender email address');
      }

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: formData.sender_email,
          subject: 'MailerSend Connection Test',
          html: `
            <h2>Connection Test Successful!</h2>
            <p>This is a test email to verify your MailerSend configuration.</p>
            <p>If you received this email, your email settings are working correctly.</p>
            <p>Sent at: ${new Date().toLocaleString()}</p>
          `
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setConnectionStatus('success');
      toast({
        title: 'Test Successful',
        description: `Test email sent to ${formData.sender_email}`,
      });
    } catch (error: any) {
      console.error('Email test failed:', error);
      setConnectionStatus('error');
      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to send test email',
        variant: 'destructive',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const saveTemplate = async (template: EmailTemplate) => {
    try {
      const { data: existingSettings } = await supabase
        .from('communication_settings')
        .select('email_templates')
        .single();

      const currentTemplates = existingSettings?.email_templates || {};
      const updatedTemplates = {
        ...(typeof currentTemplates === 'object' ? currentTemplates : {}),
        [template.status]: {
          subject: template.subject,
          html_content: template.html_content,
          variables: template.variables
        }
      };

      const { error } = await supabase.functions.invoke('business-settings', {
        body: {
          action: 'update_email_templates',
          templates: updatedTemplates
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Template Saved',
        description: `Email template for ${template.status} status has been saved.`,
      });
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save email template',
        variant: 'destructive',
      });
    }
  };

  const processQueuedEmails = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-communication-events');
      
      if (error) {
        throw error;
      }

      toast({
        title: 'Queue Processed',
        description: data.message || 'Email queue has been processed',
      });
    } catch (error: any) {
      console.error('Error processing queue:', error);
      toast({
        title: 'Error',
        description: 'Failed to process email queue',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Communication Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure email and SMS notifications for your customers.
        </p>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            MailerSend
          </TabsTrigger>
          <TabsTrigger value="smtp" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            SMTP Server
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Email Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                MailerSend Configuration
              </CardTitle>
              <CardDescription>
                Configure MailerSend for sending transactional emails to your customers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="enable_email"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Email Notifications
                          </FormLabel>
                          <FormDescription>
                            Send automatic email notifications to customers for order updates.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sender_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sender Email</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="noreply@yourdomain.com" 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            The email address that will appear as the sender
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="smtp_user"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sender Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Your Business Name" 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            The name that will appear as the sender
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <h4 className="font-medium">MailerSend Configuration</h4>
                      <a
                        href="https://app.mailersend.com/api-tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Get API Token <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <FormField
                      control={form.control}
                      name="mailersend_api_token"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MailerSend API Token</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="mlsn.xxxxxxxxxxxxxxxxxxxxx"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Your MailerSend API token for sending emails
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mailersend_domain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Domain</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="yourdomain.com"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            The domain you've verified with MailerSend
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch('mailersend_domain_verified') && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Domain verified
                      </div>
                    )}
                  </div>

                  {connectionStatus !== 'idle' && (
                    <Alert>
                      {connectionStatus === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        {connectionStatus === 'success'
                          ? 'Email connection test successful!'
                          : 'Email connection test failed. Please check your settings.'}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-4">
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : 'Save Settings'}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={testEmailConnection}
                      disabled={testingConnection || !form.getValues('sender_email')}
                      className="flex items-center gap-2"
                    >
                      <TestTube className="h-4 w-4" />
                      {testingConnection ? 'Testing...' : 'Test Connection'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp">
          <SMTPSettingsTab />
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Status Templates</CardTitle>
                <CardDescription>
                  Customize email templates for different order statuses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {defaultTemplates.map((template) => (
                    <Button
                      key={template.status}
                      variant={selectedTemplate.status === template.status ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <Badge variant="secondary" className="mr-2">
                        {template.status.replace('_', ' ')}
                      </Badge>
                      {template.subject}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Template Editor</CardTitle>
                <CardDescription>
                  Edit the template for {selectedTemplate.status.replace('_', ' ')} status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject Line</Label>
                  <Input
                    id="subject"
                    value={selectedTemplate.subject}
                    onChange={(e) => setSelectedTemplate(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Email subject..."
                  />
                </div>

                <div>
                  <Label htmlFor="content">Email Content</Label>
                  <RichTextEditor
                    value={selectedTemplate.html_content}
                    onChange={(value) => setSelectedTemplate(prev => ({ ...prev, html_content: value }))}
                    placeholder="Email content..."
                  />
                </div>

                <div>
                  <Label>Available Variables</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTemplate.variables.map((variable) => (
                      <Badge key={variable} variant="outline">
                        {`{${variable}}`}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use these variables in your template. They will be replaced with actual values when emails are sent.
                  </p>
                </div>

                <Button 
                  onClick={() => saveTemplate(selectedTemplate)}
                  className="w-full"
                >
                  Save Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Email Queue Management</CardTitle>
              <CardDescription>
                Monitor and manage the email notification queue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The email queue is processed automatically, but you can manually trigger processing if needed.
                  </AlertDescription>
                </Alert>

                <Button 
                  onClick={processQueuedEmails}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Process Email Queue
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};