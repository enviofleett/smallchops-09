import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Mail, Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw, Settings, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SMTPProvider {
  name: string;
  host: string;
  port: number;
  encryption: string;
  authType: string;
  instructions: string[];
  usernameFormat: string;
  passwordNote: string;
}

const SMTP_PROVIDERS: SMTPProvider[] = [
  {
    name: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'STARTTLS',
    authType: 'App Password',
    usernameFormat: 'your-email@gmail.com',
    passwordNote: 'Use App Password, not your regular password',
    instructions: [
      'Enable 2-Factor Authentication on your Google account',
      'Go to Google Account Settings → Security → App passwords',
      'Generate an App password for "Mail"',
      'Use your full Gmail address as username',
      'Use the generated App password (not your regular password)'
    ]
  },
  {
    name: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    encryption: 'STARTTLS',
    authType: 'API Key',
    usernameFormat: 'apikey',
    passwordNote: 'Use your SendGrid API Key',
    instructions: [
      'Login to SendGrid dashboard',
      'Go to Settings → API Keys',
      'Create a new API key with "Mail Send" permissions',
      'Username is always "apikey"',
      'Password is your SendGrid API key'
    ]
  },
  {
    name: 'Office 365 / Outlook',
    host: 'smtp-mail.outlook.com',
    port: 587,
    encryption: 'STARTTLS',
    authType: 'App Password',
    usernameFormat: 'your-email@outlook.com',
    passwordNote: 'Use App Password if 2FA enabled',
    instructions: [
      'Enable 2-Factor Authentication (recommended)',
      'Go to Microsoft Account Security → App passwords',
      'Generate an App password for email',
      'Use your full Outlook email as username',
      'Use the generated App password'
    ]
  },
  {
    name: 'Amazon SES',
    host: 'email-smtp.{region}.amazonaws.com',
    port: 587,
    encryption: 'STARTTLS',
    authType: 'SMTP Credentials',
    usernameFormat: 'SMTP Username from AWS',
    passwordNote: 'SMTP Password from AWS',
    instructions: [
      'Go to AWS SES Console',
      'Verify your domain and email addresses',
      'Go to SMTP Settings → Create SMTP Credentials',
      'Use the generated SMTP username and password',
      'Replace {region} with your AWS region (e.g., us-east-1)'
    ]
  }
];

export const SMTPConfigurationGuide: React.FC = () => {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<SMTPProvider>(SMTP_PROVIDERS[0]);
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to Clipboard',
      description: `${label} copied to clipboard`,
    });
  };

  const testSMTPConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    try {
      console.log('🔍 Testing SMTP connection...');
      
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: { 
          healthcheck: true,
          check: 'smtp'
        }
      });

      if (error) {
        throw new Error(error.message || 'SMTP test failed');
      }

      console.log('📊 SMTP test result:', data);

      if (data.smtpCheck?.configured) {
        setTestResult({
          success: true,
          message: `✅ SMTP Connection Successful!\nConnected to ${data.smtpCheck.host}:${data.smtpCheck.port} using ${data.smtpCheck.encryption}\nConfiguration source: ${data.smtpCheck.source}`
        });
        
        toast({
          title: 'SMTP Connection Test Passed',
          description: `Successfully connected to ${data.smtpCheck.host}`,
        });
      } else {
        throw new Error(data.smtpCheck?.error || 'SMTP not properly configured');
      }
    } catch (error: any) {
      console.error('💥 SMTP test error:', error);
      
      setTestResult({
        success: false,
        message: `❌ SMTP Connection Failed:\n${error.message}`
      });
      
      toast({
        title: 'SMTP Connection Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Production SMTP Configuration
          </CardTitle>
          <CardDescription>
            Configure your SMTP settings for production email delivery. Use Function Secrets for secure credential storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status */}
          <div className="flex items-center gap-4">
            <Button
              onClick={testSMTPConnection}
              disabled={isTestingConnection}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isTestingConnection ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Test SMTP Connection
            </Button>
            
            {testResult && (
              <Badge variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                {testResult.success ? 'Connected' : 'Failed'}
              </Badge>
            )}
          </div>

          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {testResult.message}
                </pre>
              </AlertDescription>
            </Alert>
          )}

          {/* Provider Configuration */}
          <Tabs defaultValue="gmail" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="gmail">Gmail</TabsTrigger>
              <TabsTrigger value="sendgrid">SendGrid</TabsTrigger>
              <TabsTrigger value="outlook">Outlook</TabsTrigger>
              <TabsTrigger value="ses">Amazon SES</TabsTrigger>
            </TabsList>

            {SMTP_PROVIDERS.map((provider, index) => (
              <TabsContent key={provider.name} value={index === 0 ? 'gmail' : index === 1 ? 'sendgrid' : index === 2 ? 'outlook' : 'ses'}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{provider.name} Configuration</CardTitle>
                    <CardDescription>
                      Follow these steps to configure {provider.name} SMTP
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Configuration Values */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">SMTP Host</label>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
                            {provider.host}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(provider.host, 'Host')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">SMTP Port</label>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
                            {provider.port}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(provider.port.toString(), 'Port')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Username Format</label>
                        <code className="bg-muted px-2 py-1 rounded text-sm block">
                          {provider.usernameFormat}
                        </code>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Encryption</label>
                        <Badge variant="outline">
                          {provider.encryption}
                        </Badge>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Setup Instructions:</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        {provider.instructions.map((instruction, i) => (
                          <li key={i} className="text-muted-foreground">
                            {instruction}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Password Note:</strong> {provider.passwordNote}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Function Secrets Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Configure Function Secrets
              </CardTitle>
              <CardDescription>
                Set up your SMTP credentials in Supabase Function Secrets for secure production use
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  Function Secrets are the secure way to store SMTP credentials in production. Never put real credentials in your database settings.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <h4 className="font-medium">Required Function Secrets:</h4>
                <div className="grid gap-2">
                  {[
                    { key: 'SMTP_HOST', description: 'Your SMTP server hostname' },
                    { key: 'SMTP_PORT', description: 'SMTP port (usually 587)' },
                    { key: 'SMTP_USERNAME', description: 'Your SMTP username/email' },
                    { key: 'SMTP_PASSWORD', description: 'Your SMTP password/API key' },
                    { key: 'SMTP_FROM_EMAIL', description: 'From email address (optional)' },
                    { key: 'SMTP_FROM_NAME', description: 'From name (optional)' }
                  ].map((secret) => (
                    <div key={secret.key} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <code className="text-sm font-mono">{secret.key}</code>
                        <p className="text-xs text-muted-foreground">{secret.description}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(secret.key, 'Secret name')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button asChild>
                  <a 
                    href={`https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Function Secrets
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};