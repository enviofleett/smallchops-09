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
import { AlertCircle, CheckCircle2, Mail, Send, Settings, TestTube, Server } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SMTPSettingsTab } from './SMTPSettingsTab';

const communicationSchema = z.object({
  use_smtp: z.boolean().default(true),
  smtp_host: z.string().min(1, 'SMTP host is required'),
  smtp_port: z.number().min(1, 'Port is required'),
  smtp_user: z.string().min(1, 'Username is required'),
  smtp_pass: z.string().min(1, 'Password is required'),
  smtp_secure: z.boolean().default(true),
  sender_email: z.string().email('Invalid email address'),
  sender_name: z.string().min(1, 'Sender name is required'),
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
    status: 'shipped',
    subject: 'Order Shipped - #{order_number}',
    html_content: `<h2>Your order has been shipped!</h2>
<p>Dear {customer_name},</p>
<p>Your order <strong>#{order_number}</strong> has been shipped and is on its way.</p>
<p>You can track your order using this tracking number: <strong>{tracking_number}</strong></p>
<p>Thank you for shopping with us!</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number', 'tracking_number']
  },
  {
    status: 'delivered',
    subject: 'Order Delivered - #{order_number}',
    html_content: `<h2>Your order has been delivered!</h2>
<p>Dear {customer_name},</p>
<p>Your order <strong>#{order_number}</strong> has been successfully delivered.</p>
<p>We hope you enjoy your purchase!</p>
<p>If you have any questions or concerns, please contact us.</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number']
  },
  {
    status: 'cancelled',
    subject: 'Order Cancelled - #{order_number}',
    html_content: `<h2>Order Cancelled</h2>
<p>Dear {customer_name},</p>
<p>Your order <strong>#{order_number}</strong> has been cancelled.</p>
<p>If you have any questions or concerns, please contact us.</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number']
  },
  {
    status: 'refunded',
    subject: 'Order Refunded - #{order_number}',
    html_content: `<h2>Order Refunded</h2>
<p>Dear {customer_name},</p>
<p>Your order <strong>#{order_number}</strong> has been refunded.</p>
<p>The refund amount will be credited back to your account within 5-7 business days.</p>
<p>If you have any questions or concerns, please contact us.</p>
<p>Best regards,<br>Your Team</p>`,
    variables: ['customer_name', 'order_number']
  },
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
      use_smtp: true,
      smtp_host: '',
      smtp_port: 587,
      smtp_user: '',
      smtp_pass: '',
      smtp_secure: true,
      sender_email: '',
      sender_name: '',
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
          use_smtp: data.use_smtp !== false,
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || 587,
          smtp_user: data.smtp_user || '',
          smtp_pass: data.smtp_pass || '',
          smtp_secure: data.smtp_secure !== false,
          sender_email: data.sender_email || '',
          sender_name: data.sender_name || '',
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
            use_smtp: data.use_smtp,
            smtp_host: data.smtp_host,
            smtp_port: data.smtp_port,
            smtp_user: data.smtp_user,
            smtp_pass: data.smtp_pass,
            smtp_secure: data.smtp_secure,
            sender_email: data.sender_email,
            sender_name: data.sender_name,
            email_provider: 'smtp'
          }
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Settings Saved',
        description: 'SMTP settings have been updated successfully.',
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

      const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
        body: {
          to: formData.sender_email,
          subject: 'SMTP Connection Test',
          html: `
            <h2>Connection Test Successful!</h2>
            <p>This is a test email to verify your SMTP configuration.</p>
            <p>If you received this email, your SMTP settings are working correctly.</p>
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
        <h3 className="text-lg font-medium">Email Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Basic SMTP settings. For advanced email management, templates, and analytics, use the Email Management interface.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Management Dashboard
          </CardTitle>
          <CardDescription>
            Access the comprehensive email management interface for advanced features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Advanced Email Management</h4>
              <p className="text-sm text-muted-foreground">
                Manage SMTP settings, email templates, analytics, and testing in a unified interface
              </p>
            </div>
            <Button 
              onClick={() => window.open('/email-management', '_blank')}
              className="shrink-0"
            >
              <Settings className="mr-2 h-4 w-4" />
              Open Email Management
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Note:</strong> The Email Management interface provides comprehensive tools for:
            • Advanced SMTP configuration
            • Email template creation and editing
            • Delivery analytics and monitoring
            • Email testing and queue management
          </div>
        </CardContent>
      </Card>

      <div className="border-t pt-6">
        <h4 className="text-md font-medium mb-4">Quick SMTP Setup</h4>
        <SMTPSettingsTab />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Quick Test
          </CardTitle>
          <CardDescription>
            Send a test email to verify your SMTP configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Enter test email address"
              type="email"
              className="flex-1"
              onChange={(e) => form.setValue('sender_email', e.target.value)}
            />
            <Button 
              onClick={testEmailConnection} 
              disabled={testingConnection}
            >
              {testingConnection ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
          
          {connectionStatus === 'success' && (
            <Alert className="mt-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Test email sent successfully! Check your inbox.
              </AlertDescription>
            </Alert>
          )}
          
          {connectionStatus === 'error' && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to send test email. Please check your SMTP settings.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
