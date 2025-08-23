import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Mail, Shield, TestTube, ExternalLink, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const smtpSchema = z.object({
  use_smtp: z.boolean().default(false),
  email_provider: z.enum(['smtp']).default('smtp'),
  smtp_host: z.string().min(1, 'SMTP host is required').optional().or(z.literal('')),
  smtp_port: z.number().min(1).max(65535).default(587),
  smtp_user: z.string().min(1, 'SMTP username is required').optional().or(z.literal('')),
  smtp_pass: z.string().min(1, 'SMTP password is required').optional().or(z.literal('')),
  smtp_secure: z.boolean().default(true),
  sender_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  sender_name: z.string().optional().or(z.literal('')),
});

type SMTPFormData = z.infer<typeof smtpSchema>;

interface SMTPProvider {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  description: string;
}

const commonProviders: SMTPProvider[] = [
  {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: true,
    description: 'Use Gmail SMTP with App Password'
  },
  {
    name: 'Outlook/Hotmail',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: true,
    description: 'Microsoft Outlook SMTP'
  },
  {
    name: 'Yahoo',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: true,
    description: 'Yahoo Mail SMTP'
  },
  {
    name: 'YouNotify SMTP',
    host: 'smtp.yournotify.com',
    port: 587,
    secure: true,
    description: 'YouNotify SMTP Service'
  },
  {
    name: 'Custom SMTP',
    host: '',
    port: 587,
    secure: true,
    description: 'Custom SMTP server configuration'
  }
];

// Add this helper component for better error display
const SMTPStatusAlert = ({ status, error }: { status: string, error?: string }) => {
  if (status === 'success') {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>SMTP Connection Successful!</strong> Your configuration is working correctly.
          Check your email inbox for the test message.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>SMTP Connection Failed:</strong> {error || 'Unknown error'}
          <div className="mt-2 text-sm">
            <strong>Common solutions:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>For Gmail: Use App Password (16 characters), not regular password</li>
              <li>Verify host, port, and credentials are correct</li>
              <li>Check if two-factor authentication is enabled</li>
              <li>Ensure SMTP access is enabled for your account</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  
  return null;
};

export const SMTPSettingsTab = () => {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedProvider, setSelectedProvider] = useState<SMTPProvider | null>(null);
  const [lastError, setLastError] = useState<string>('');
  const { toast } = useToast();

  const form = useForm<SMTPFormData>({
    resolver: zodResolver(smtpSchema),
    defaultValues: {
      use_smtp: false,
      email_provider: 'smtp',
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
    loadSMTPSettings();
  }, []);

  const loadSMTPSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        form.reset({
          use_smtp: (data as any).use_smtp || false,
          email_provider: (data as any).email_provider || 'smtp',
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || 587,
          smtp_user: data.smtp_user || '',
          smtp_pass: data.smtp_pass || '',
          smtp_secure: (data as any).smtp_secure !== false,
          sender_email: data.sender_email || '',
          sender_name: (data as any).sender_name || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading SMTP settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load SMTP settings',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: SMTPFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('business-settings', {
        body: {
          action: 'update_communication_settings',
          settings: {
            use_smtp: data.use_smtp,
            email_provider: data.email_provider,
            smtp_host: data.smtp_host || null,
            smtp_port: data.smtp_port || null,
            smtp_user: data.smtp_user || null,
            smtp_pass: data.smtp_pass || null,
            smtp_secure: data.smtp_secure,
            sender_email: data.sender_email || null,
            sender_name: data.sender_name || null,
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
      console.error('Error saving SMTP settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save SMTP settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Add validation function inside component
  const validateSMTPCredentials = (data: SMTPFormData): string | null => {
    if (!data.smtp_host || !data.smtp_user || !data.smtp_pass || !data.sender_email) {
      return 'Please fill in all required SMTP fields';
    }
    
    if (data.smtp_pass === data.smtp_user) {
      return 'SMTP password cannot be the same as username. Please use your actual password or app-specific password.';
    }
    
    if (data.smtp_pass.length < 6) {
      return 'SMTP password seems too short. Please ensure you are using the correct password or app-specific password.';
    }
    
    return null;
  };

  // Enhanced testSMTPConnection function:
const testSMTPConnection = async () => {
  setTestingConnection(true);
  setConnectionStatus('idle');
  
  try {
    const formData = form.getValues();
    
    // Enhanced validation
    const validationError = validateSMTPCredentials(formData);
    if (validationError) {
      throw new Error(validationError);
    }

    // Additional Gmail-specific validation
    if (formData.smtp_host === 'smtp.gmail.com') {
      if (!formData.smtp_pass.match(/^[a-z]{16}$/)) {
        toast({
          title: 'Gmail Configuration Warning',
          description: 'For Gmail, you need a 16-character app password. Regular Gmail passwords will not work.',
          variant: 'destructive',
        });
      }
    }

    // Save settings first to ensure they're in the database
    console.log('Saving SMTP settings before test...');
    const { error: saveError } = await supabase.functions.invoke('business-settings', {
      body: {
        action: 'update_communication_settings',
        settings: {
          use_smtp: true, // Temporarily enable for test
          email_provider: formData.email_provider,
          smtp_host: formData.smtp_host,
          smtp_port: formData.smtp_port,
          smtp_user: formData.smtp_user,
          smtp_pass: formData.smtp_pass,
          smtp_secure: formData.smtp_secure,
          sender_email: formData.sender_email,
          sender_name: formData.sender_name,
        }
      }
    });

    if (saveError) {
      throw new Error(`Failed to save settings: ${saveError.message}`);
    }

    console.log('Settings saved, now testing SMTP connection...');

    // Wait a moment for settings to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
      body: {
        to: formData.sender_email,
        subject: 'SMTP Connection Test - ' + new Date().toISOString(),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">✅ SMTP Connection Test Successful!</h2>
            <p>Congratulations! Your SMTP configuration is working correctly.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>Configuration Details:</h3>
              <ul>
                <li><strong>Host:</strong> ${formData.smtp_host}</li>
                <li><strong>Port:</strong> ${formData.smtp_port}</li>
                <li><strong>Secure:</strong> ${formData.smtp_secure ? 'Yes (TLS/SSL)' : 'No'}</li>
                <li><strong>Username:</strong> ${formData.smtp_user}</li>
                <li><strong>Sender:</strong> ${formData.sender_name || 'N/A'} &lt;${formData.sender_email}&gt;</li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              <strong>Test Details:</strong><br>
              Sent at: ${new Date().toLocaleString()}<br>
              Test ID: ${Date.now()}
            </p>
            
            <div style="background-color: #dbeafe; padding: 10px; border-radius: 4px; margin-top: 20px;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                💡 <strong>Next Steps:</strong> Your SMTP is ready for production use. 
                You can now send transactional and marketing emails through your custom SMTP server.
              </p>
            </div>
          </div>
        `,
        text: `SMTP Connection Test Successful!\n\nYour SMTP configuration is working correctly.\n\nConfiguration:\n- Host: ${formData.smtp_host}\n- Port: ${formData.smtp_port}\n- Secure: ${formData.smtp_secure ? 'Yes' : 'No'}\n- User: ${formData.smtp_user}\n\nSent at: ${new Date().toLocaleString()}`
      }
    });

    if (error) {
      console.error('SMTP test error:', error);
      throw new Error(error.message || 'SMTP test failed');
    }

    if (data && data.error) {
      throw new Error(data.error);
    }

    setConnectionStatus('success');
    toast({
      title: '🎉 SMTP Test Successful!',
      description: `Test email sent successfully to ${formData.sender_email}. Check your inbox!`,
    });

    // Auto-save settings after successful test
    form.setValue('use_smtp', true);
    
  } catch (error: any) {
    console.error('SMTP test failed:', error);
    setConnectionStatus('error');
    
    let errorMessage = error.message || 'Unknown error occurred';
    
    // Provide specific guidance based on error type
    if (errorMessage.includes('535')) {
      errorMessage = 'Authentication failed (Error 535). Please check:\n• Username and password are correct\n• For Gmail: Use App Password, not regular password\n• Account has SMTP access enabled';
    } else if (errorMessage.includes('connection')) {
      errorMessage = 'Connection failed. Please check:\n• SMTP host and port are correct\n• Internet connection is stable\n• Firewall is not blocking the connection';
    }
    
    setLastError(errorMessage);
    toast({
      title: 'SMTP Test Failed',
      description: errorMessage,
      variant: 'destructive',
    });
  } finally {
    setTestingConnection(false);
  }
};

  const handleProviderSelect = (provider: SMTPProvider) => {
    setSelectedProvider(provider);
    if (provider.name !== 'Custom') {
      form.setValue('smtp_host', provider.host);
      form.setValue('smtp_port', provider.port);
      form.setValue('smtp_secure', provider.secure);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">SMTP Email Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure custom SMTP server for sending emails directly through your preferred email provider.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SMTP Settings
          </CardTitle>
          <CardDescription>
            Use your own SMTP server for sending transactional and marketing emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="use_smtp"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Enable SMTP Email
                      </FormLabel>
                      <FormDescription>
                        Use your own SMTP server for sending emails.
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

              {form.watch('use_smtp') && (
                <>
                  <FormField
                    control={form.control}
                    name="email_provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Provider Strategy</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select email provider strategy" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="smtp">SMTP</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Email sending is configured to use your SMTP server for reliable delivery.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <h4 className="font-medium">Quick Setup</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {commonProviders.map((provider) => (
                        <Button
                          key={provider.name}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleProviderSelect(provider)}
                          className={selectedProvider?.name === provider.name ? 'bg-primary/10' : ''}
                        >
                          {provider.name}
                        </Button>
                      ))}
                    </div>

                    {selectedProvider && selectedProvider.name !== 'Custom' && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{selectedProvider.name}:</strong> {selectedProvider.description}
                          {selectedProvider.name === 'Gmail' && (
                            <span className="block mt-1">
                              <a
                                href="https://support.google.com/accounts/answer/185833"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                Generate App Password <ExternalLink className="h-3 w-3" />
                              </a>
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="smtp_host"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Host</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="smtp.gmail.com" 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Your SMTP server hostname
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="smtp_port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Port</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="587" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 587)}
                            />
                          </FormControl>
                          <FormDescription>
                            Usually 587 for TLS or 465 for SSL
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
                          <FormLabel>SMTP Username</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="your-email@gmail.com" 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Your SMTP username (usually your email)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                     <FormField
                       control={form.control}
                       name="smtp_pass"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>SMTP Password</FormLabel>
                           <FormControl>
                             <Input 
                               type="password"
                               placeholder="Your app password" 
                               {...field} 
                               value={field.value || ''}
                             />
                           </FormControl>
                           <FormDescription>
                             Your SMTP password or app-specific password
                           </FormDescription>
                           {field.value === form.watch('smtp_user') && field.value && (
                             <Alert variant="destructive">
                               <AlertCircle className="h-4 w-4" />
                               <AlertDescription>
                                 <strong>Critical Issue:</strong> Password cannot be the same as username. 
                                 Please enter your actual SMTP password or app-specific password.
                               </AlertDescription>
                             </Alert>
                           )}
                           <FormMessage />
                         </FormItem>
                       )}
                     />

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
                      name="sender_name"
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

                  <FormField
                    control={form.control}
                    name="smtp_secure"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use Secure Connection (TLS/SSL)
                          </FormLabel>
                          <FormDescription>
                            Enable secure connection to SMTP server (recommended).
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

                   <div className="space-y-4">
                     <div className="flex items-center gap-4">
                       <Button
                         type="button"
                         variant="outline"
                         onClick={testSMTPConnection}
                         disabled={testingConnection}
                         className="flex items-center gap-2"
                       >
                         <TestTube className="h-4 w-4" />
                         {testingConnection ? 'Testing...' : 'Test SMTP Connection'}
                       </Button>

                       {connectionStatus === 'success' && (
                         <Badge variant="default" className="flex items-center gap-1">
                           <CheckCircle2 className="h-3 w-3" />
                           Connection Successful
                         </Badge>
                       )}

                       {connectionStatus === 'error' && (
                         <Badge variant="destructive" className="flex items-center gap-1">
                           <AlertCircle className="h-3 w-3" />
                           Connection Failed
                         </Badge>
                       )}
                     </div>

                     <SMTPStatusAlert status={connectionStatus} error={lastError} />
                   </div>
                </>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save SMTP Settings'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};