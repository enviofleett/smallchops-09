import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Server, 
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Mail,
  Settings,
  Key,
  Database
} from 'lucide-react';

interface ProviderConfig {
  name: string;
  host: string;
  port: string;
  userFormat: string;
  passFormat: string;
  instructions: string[];
  setupUrl?: string;
}

const emailProviders: Record<string, ProviderConfig> = {
  gmail: {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: '587',
    userFormat: 'your-email@gmail.com',
    passFormat: '16-character App Password',
    instructions: [
      'Enable 2-Factor Authentication on your Google account',
      'Go to Google Account → Security → App passwords',
      'Generate a new App Password for "Mail"',
      'Use the 16-character password (not your regular password)'
    ],
    setupUrl: 'https://support.google.com/accounts/answer/185833'
  },
  sendgrid: {
    name: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: '587',
    userFormat: 'apikey',
    passFormat: 'API Key (starts with SG.)',
    instructions: [
      'Create SendGrid account and verify email',
      'Go to Settings → API Keys',
      'Create new API key with "Mail Send" permissions',
      'Use "apikey" as username and API key as password'
    ],
    setupUrl: 'https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api'
  },
  ses: {
    name: 'AWS SES',
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: '587',
    userFormat: 'SMTP Username (starts with AKIA)',
    passFormat: 'SMTP Password',
    instructions: [
      'Setup AWS SES and verify your domain',
      'Go to SES Console → SMTP Settings',
      'Create SMTP credentials',
      'Use the generated username and password'
    ],
    setupUrl: 'https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html'
  },
  mailgun: {
    name: 'Mailgun',
    host: 'smtp.mailgun.org',
    port: '587',
    userFormat: 'postmaster@your-domain.mailgun.org',
    passFormat: 'SMTP Password',
    instructions: [
      'Create Mailgun account and verify domain',
      'Go to Domains → Domain Settings',
      'Find SMTP credentials section',
      'Use postmaster email and SMTP password'
    ],
    setupUrl: 'https://documentation.mailgun.com/en/latest/user_manual.html#smtp'
  }
};

export const ProductionEnvironmentSetup: React.FC = () => {
  const [selectedProvider, setSelectedProvider] = useState<string>('gmail');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const testProduction = async () => {
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('smtp-auth-healthcheck');
      
      if (error) throw error;
      
      if (data?.success && data?.provider?.source === 'function_secrets') {
        setConnectionStatus('success');
        toast({
          title: "Production Ready!",
          description: "SMTP configured correctly via Function Secrets",
        });
      } else if (data?.provider?.source === 'database') {
        setConnectionStatus('error');
        toast({
          title: "Not Production Ready",
          description: "Still using database configuration. Please configure Function Secrets.",
          variant: "destructive"
        });
      } else {
        throw new Error('SMTP configuration not found or invalid');
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast({
        title: "Configuration Issue",
        description: error.message || "Failed to verify production configuration",
        variant: "destructive"
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const generateSecretCommands = (provider: string) => {
    const config = emailProviders[provider];
    return `# Configure SMTP Function Secrets for ${config.name}
supabase secrets set SMTP_HOST="${config.host}"
supabase secrets set SMTP_PORT="${config.port}"
supabase secrets set SMTP_USER="${config.userFormat}"
supabase secrets set SMTP_PASS="${config.passFormat}"
supabase secrets set SENDER_EMAIL="noreply@yourbusiness.com"
supabase secrets set SENDER_NAME="Your Business Name"
supabase secrets set EMAIL_PRODUCTION_MODE="true"
supabase secrets set DENO_ENV="production"`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <CardTitle>Production Environment Setup</CardTitle>
          </div>
          <CardDescription>
            Configure Function Secrets for secure, production-ready email delivery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security First:</strong> Production systems must use Function Secrets, never database credentials. 
              Function Secrets are encrypted and only accessible to your edge functions.
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Status Check */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Current Status
              </h3>
              
              <Button 
                onClick={testProduction} 
                disabled={testingConnection}
                className="w-full"
                variant="outline"
              >
                {testingConnection ? 'Testing...' : 'Check Production Status'}
              </Button>
              
              {connectionStatus === 'success' && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    <strong>Production Ready!</strong> Function Secrets properly configured.
                  </AlertDescription>
                </Alert>
              )}
              
              {connectionStatus === 'error' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Not Production Ready.</strong> Configure Function Secrets below.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Quick Setup Links
              </h3>
              
              <div className="space-y-2">
                <Button variant="outline" size="sm" asChild className="w-full justify-start">
                  <a 
                    href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Supabase Function Secrets
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>
                
                <Button variant="outline" size="sm" asChild className="w-full justify-start">
                  <a 
                    href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/functions/unified-smtp-sender/logs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Server className="h-4 w-4 mr-2" />
                    Function Logs
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Provider Configuration
          </CardTitle>
          <CardDescription>
            Choose your email provider and get the exact configuration needed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedProvider} onValueChange={setSelectedProvider} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="gmail">Gmail</TabsTrigger>
              <TabsTrigger value="sendgrid">SendGrid</TabsTrigger>
              <TabsTrigger value="ses">AWS SES</TabsTrigger>
              <TabsTrigger value="mailgun">Mailgun</TabsTrigger>
            </TabsList>
            
            {Object.entries(emailProviders).map(([key, provider]) => (
              <TabsContent key={key} value={key} className="space-y-4">
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{provider.name} Configuration</h3>
                    {provider.setupUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={provider.setupUrl} target="_blank" rel="noopener noreferrer">
                          Setup Guide
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                  
                  {/* Configuration Details */}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium">SMTP Host</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-muted px-2 py-1 rounded flex-1">{provider.host}</code>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => copyToClipboard(provider.host, 'SMTP Host')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">SMTP Port</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-muted px-2 py-1 rounded flex-1">{provider.port}</code>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => copyToClipboard(provider.port, 'SMTP Port')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Setup Instructions */}
                  <div>
                    <Label className="text-sm font-medium">Setup Instructions</Label>
                    <ol className="list-decimal list-inside text-sm text-muted-foreground mt-2 space-y-1">
                      {provider.instructions.map((instruction, index) => (
                        <li key={index}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                  
                  {/* CLI Commands */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Function Secrets CLI Commands</Label>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => copyToClipboard(generateSecretCommands(key), 'CLI Commands')}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy All
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                      {generateSecretCommands(key)}
                    </pre>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Security Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Production Security Checklist
          </CardTitle>
          <CardDescription>
            Essential security measures for production email deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Function Secrets Configuration</p>
                <p className="text-xs text-muted-foreground">
                  All SMTP credentials stored as encrypted Function Secrets
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Domain Authentication</p>
                <p className="text-xs text-muted-foreground">
                  Configure SPF, DKIM, and DMARC records for your domain
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Rate Limiting</p>
                <p className="text-xs text-muted-foreground">
                  Built-in rate limiting active - monitor usage to avoid provider blocks
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Email Templates</p>
                <p className="text-xs text-muted-foreground">
                  All customer emails must use approved templates in production mode
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Production Verification */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Production Deployment Verification</CardTitle>
          <CardDescription>
            Final checks before going live with email system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Before going live:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>✅ Function Secrets configured and tested</li>
                <li>✅ All critical email templates created and active</li>
                <li>✅ Domain authentication (SPF/DKIM/DMARC) configured</li>
                <li>✅ Production mode enabled (EMAIL_PRODUCTION_MODE=true)</li>
                <li>✅ Test emails sent and delivered successfully</li>
                <li>✅ Monitoring and alerting configured</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

const Label: React.FC<{ className?: string; children: React.ReactNode }> = ({ 
  className = "", 
  children 
}) => (
  <label className={`block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>
    {children}
  </label>
);