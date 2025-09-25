import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEnvironmentConfig } from '@/hooks/useEnvironmentConfig';
import { 
  Shield,
  Key,
  AlertTriangle,
  CheckCircle2,
  Server,
  TestTube,
  Settings,
  ExternalLink,
  Lock,
  Copy
} from 'lucide-react';

const credentialsSchema = z.object({
  smtp_host: z.string().min(1, 'SMTP host is required'),
  smtp_port: z.string().regex(/^\d+$/, 'Port must be a number').refine(val => {
    const num = parseInt(val);
    return num >= 1 && num <= 65535;
  }, 'Port must be between 1 and 65535'),
  smtp_username: z.string().min(1, 'SMTP username is required'),
  smtp_password: z.string().min(1, 'SMTP password is required'),
  smtp_from_email: z.string().email('Invalid email address'),
  smtp_from_name: z.string().min(1, 'Sender name is required'),
  smtp_encryption: z.enum(['TLS', 'SSL']).default('TLS'),
});

type CredentialsFormData = z.infer<typeof credentialsSchema>;

interface CredentialStatus {
  name: string;
  isSet: boolean;
  masked?: string;
}

export const EmailCredentialsManager = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastError, setLastError] = useState<string>('');
  const { toast } = useToast();
  const { config: envConfig, loading: envLoading } = useEnvironmentConfig();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      smtp_port: '587',
      smtp_encryption: 'TLS'
    }
  });

  useEffect(() => {
    checkCredentialStatus();
  }, []);

  const checkCredentialStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('smtp-auth-healthcheck', {
        body: {}
      });

      if (error) {
        console.error('Failed to check credential status:', error);
        setCredentials([]);
        return;
      }

      // Focus on the 4 core production secrets
      const coreCredentials = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
      const statusList = coreCredentials.map(name => ({
        name,
        isSet: data?.success && data?.provider?.source === 'function_secrets',
        masked: data?.success && data?.provider?.source === 'function_secrets' ? '✓ Configured in Function Secrets' : undefined
      }));

      setCredentials(statusList);
    } catch (error) {
      console.error('Error checking credentials:', error);
      setCredentials([]);
    }
  };

  const maskValue = (value: string): string => {
    if (!value) return '';
    if (value.includes('@')) {
      // Email masking
      const [local, domain] = value.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }
    // General value masking
    if (value.length <= 4) return '***';
    return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
  };

  const onSubmit = async (data: CredentialsFormData) => {
    setIsLoading(true);
    try {
      // This would typically call an admin endpoint to set Function Secrets
      // For now, we'll show instructions for manual setup
      toast({
        title: 'Credentials Configuration',
        description: 'Please configure these credentials in Supabase Function Secrets. See the instructions below.',
      });

      // Store temporarily in database as fallback while Function Secrets are being set up
      await storeTemporaryCredentials(data);
      
    } catch (error: any) {
      console.error('Error saving credentials:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save credentials',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const storeTemporaryCredentials = async (data: CredentialsFormData) => {
    const { error } = await supabase.functions.invoke('business-settings', {
      body: {
        action: 'update_communication_settings',
        settings: {
          use_smtp: true,
          smtp_host: data.smtp_host,
          smtp_port: parseInt(data.smtp_port),
          smtp_user: data.smtp_username,
          smtp_pass: data.smtp_password,
          smtp_secure: data.smtp_encryption === 'TLS',
          sender_email: data.smtp_from_email,
          sender_name: data.smtp_from_name,
        }
      }
    });

    if (error) throw error;

    toast({
      title: 'Temporary Storage Updated',
      description: 'Credentials stored in database as fallback. Please set up Function Secrets for production.',
    });
    
    checkCredentialStatus();
  };

  const testConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    setLastError('');

    try {
      console.log('🔍 Testing production email readiness...');
      
      // Test production SMTP readiness
      const { data: authData, error: authError } = await supabase.functions.invoke('smtp-auth-healthcheck', {
        body: {}
      });

      if (authError) {
        throw new Error(`Health check failed: ${authError.message}`);
      }

      console.log('📊 Production readiness result:', authData);

      if (authData?.success) {
        setConnectionStatus('success');
        
        // Get configuration source info
        const configSource = authData.provider?.source === 'function_secrets' 
          ? 'Function Secrets (Production Ready)' 
          : authData.provider?.source === 'database'
          ? 'Database (Development Mode)'
          : 'Legacy Configuration';
          
        const isProductionReady = authData.provider?.source === 'function_secrets';
          
        toast({
          title: isProductionReady ? 'Production Ready!' : 'Configuration Found',
          description: `✅ SMTP authenticated successfully via ${configSource}`,
          variant: isProductionReady ? 'default' : 'destructive'
        });
        
        // Update status with detailed info
        setLastError('');
        checkCredentialStatus(); // Refresh the credential status
        
      } else {
        throw new Error(authData?.error || 'SMTP authentication failed');
      }
      
    } catch (error: any) {
      console.error('❌ Production readiness test failed:', error);
      setConnectionStatus('error');
      setLastError(error.message);
      
      toast({
        title: 'Production Not Ready',
        description: `❌ ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const credentialsConfigured = credentials.filter(c => c.isSet).length;
  const totalCredentials = credentials.length;
  const isLiveMode = envConfig?.isLiveMode || false;
  const isProductionReady = credentialsConfigured === totalCredentials && credentialsConfigured > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Email Credentials Manager</h2>
          <p className="text-muted-foreground">
            Securely configure SMTP credentials for production email delivery
          </p>
        </div>
        <Badge variant={credentialsConfigured === totalCredentials ? "default" : "secondary"}>
          {credentialsConfigured}/{totalCredentials} Configured
        </Badge>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Production Credential Status
          </CardTitle>
          <CardDescription>
            Current status of Function Secrets for production email delivery
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLiveMode && !isProductionReady && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <Lock className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Production Mode Active:</strong> SMTP credentials must be configured via Edge Function Secrets.
                <br />
                <a 
                  href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline font-medium mt-1 inline-block"
                >
                  Configure Function Secrets →
                </a>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3">
            {credentials.map((cred) => (
              <div key={cred.name} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${cred.isSet ? 'bg-green-100 dark:bg-green-900/20' : 'bg-amber-100 dark:bg-amber-900/20'}`}>
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{cred.name}</span>
                    <div className="text-xs text-muted-foreground">
                      {cred.name === 'SMTP_HOST' && 'Mail server hostname (e.g., smtp.yourprovider.com)'}
                      {cred.name === 'SMTP_PORT' && 'Connection port (common: 587 for TLS, 465 for SSL)'}
                      {cred.name === 'SMTP_USER' && 'Authentication username/email'}
                      {cred.name === 'SMTP_PASS' && 'Authentication password/app password'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cred.isSet ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600 dark:text-green-400">Configured</div>
                        <div className="text-xs text-muted-foreground">{cred.masked}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      <div className="text-right">
                        <div className="text-sm font-medium text-amber-600 dark:text-amber-400">Missing</div>
                        <div className="text-xs text-muted-foreground">Required for production</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {credentialsConfigured > 0 && (
            <div className="mt-4">
              <Button onClick={testConnection} disabled={isTesting} className="w-full">
                <TestTube className="h-4 w-4 mr-2" />
                {isTesting ? 'Testing Production Readiness...' : 'Test Production Email Readiness'}
              </Button>

              {connectionStatus === 'success' && (
                <Alert className="mt-4 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Connection Successful!</strong> Production SMTP is ready for use.
                  </AlertDescription>
                </Alert>
              )}

              {connectionStatus === 'error' && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Connection Failed:</strong> {lastError}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Production Setup Instructions
          </CardTitle>
          <CardDescription>
            How to configure Function Secrets for secure production deployment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> Function Secrets provide the most secure way to store SMTP credentials in production. 
              Never store real credentials in your database or code.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">1.</span>
              <span>Go to your Supabase Dashboard → Settings → Edge Functions</span>
              <Button variant="outline" size="sm" asChild>
                <a 
                  href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                </a>
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-semibold">2.</span>
              <span>Add the following Function Secrets:</span>
            </div>

            <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
              <div><strong>SMTP_HOST:</strong> Your provider's SMTP hostname</div>
              <div><strong>SMTP_PORT:</strong> Standard ports: 587 (TLS) or 465 (SSL)</div>
              <div><strong>SMTP_USER:</strong> your-email@domain.com</div>
              <div><strong>SMTP_PASS:</strong> your-app-password</div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const commands = [
                    'supabase secrets set SMTP_HOST=smtp.yourprovider.com',
                    'supabase secrets set SMTP_PORT=587',
                    'supackage secrets set SMTP_USER=your-email@provider.com',
                    'supabase secrets set SMTP_PASS=your-16-char-app-password'
                  ].join('\n');
                  navigator.clipboard.writeText(commands);
                  toast({ title: 'CLI Commands Copied!', description: 'Paste into your terminal' });
                }}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy CLI Commands
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold">3.</span>
              <span>Test the configuration using the button above</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Development Fallback Form */}
      {!isLiveMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Development Fallback Configuration
            </CardTitle>
            <CardDescription>
              Temporary credentials for development and testing (not recommended for production)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Development Mode:</strong> These credentials are stored in the database for testing only. 
                Switch to Live mode and configure Function Secrets for production deployment.
              </AlertDescription>
            </Alert>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input
                  id="smtp_host"
                  {...register('smtp_host')}
                  placeholder="smtp.example.com"
                />
                {errors.smtp_host && (
                  <p className="text-sm text-destructive mt-1">{errors.smtp_host.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input
                  id="smtp_port"
                  {...register('smtp_port')}
                  placeholder="587 or 465"
                />
                {errors.smtp_port && (
                  <p className="text-sm text-destructive mt-1">{errors.smtp_port.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="smtp_username">Username</Label>
                <Input
                  id="smtp_username"
                  {...register('smtp_username')}
                  placeholder="your-username"
                />
                {errors.smtp_username && (
                  <p className="text-sm text-destructive mt-1">{errors.smtp_username.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="smtp_password">Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  {...register('smtp_password')}
                  placeholder="your-secure-password"
                />
                {errors.smtp_password && (
                  <p className="text-sm text-destructive mt-1">{errors.smtp_password.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="smtp_from_email">From Email</Label>
                <Input
                  id="smtp_from_email"
                  type="email"
                  {...register('smtp_from_email')}
                  placeholder="noreply@yourdomain.com"
                />
                {errors.smtp_from_email && (
                  <p className="text-sm text-destructive mt-1">{errors.smtp_from_email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="smtp_from_name">From Name</Label>
                <Input
                  id="smtp_from_name"
                  {...register('smtp_from_name')}
                  placeholder="Your Business Name"
                />
                {errors.smtp_from_name && (
                  <p className="text-sm text-destructive mt-1">{errors.smtp_from_name.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Saving...' : 'Save Development Configuration'}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      {isLiveMode && (
        <Alert className="border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Live Mode Active:</strong> Development fallback configuration is disabled. 
            All SMTP credentials must be configured via Edge Function Secrets for security.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};