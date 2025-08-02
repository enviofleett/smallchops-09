import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Server, 
  Shield, 
  Settings, 
  Plus, 
  Trash2, 
  TestTube,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

const providerSchema = z.object({
  name: z.string().min(1, 'Provider name is required'),
  host: z.string().min(1, 'SMTP host is required'),
  port: z.number().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
  is_primary: z.boolean().default(false),
  is_active: z.boolean().default(true),
  daily_limit: z.number().min(1).default(1000),
  hourly_limit: z.number().min(1).default(100),
  priority: z.number().min(1).default(1)
});

type ProviderFormData = z.infer<typeof providerSchema>;

interface SMTPProvider {
  id: string;
  name: string;
  host: string;
  port: number;
  username?: string;
  is_primary: boolean;
  is_active: boolean;
  daily_limit: number;
  hourly_limit: number;
  priority: number;
  health_score: number;
  consecutive_failures: number;
  last_health_check: string;
}

export const ProductionSMTPSettings = () => {
  const [providers, setProviders] = useState<SMTPProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingProvider, setIsTestingProvider] = useState<string | null>(null);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      port: 587,
      is_primary: false,
      is_active: true,
      daily_limit: 1000,
      hourly_limit: 100,
      priority: 1
    }
  });

  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('smtp_provider_configs')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error('Error fetching SMTP providers:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch SMTP providers',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitProvider = async (data: ProviderFormData) => {
    try {
      // If setting as primary, update others to not be primary
      if (data.is_primary) {
        await supabase
          .from('smtp_provider_configs')
          .update({ is_primary: false })
          .neq('id', '');
      }

      const { error } = await supabase
        .from('smtp_provider_configs')
        .insert({
          name: data.name,
          host: data.host,
          port: data.port,
          username: data.username,
          is_primary: data.is_primary,
          is_active: data.is_active,
          daily_limit: data.daily_limit,
          hourly_limit: data.hourly_limit,
          priority: data.priority
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'SMTP provider added successfully',
      });

      reset();
      setShowAddProvider(false);
      fetchProviders();
    } catch (error) {
      console.error('Error adding SMTP provider:', error);
      toast({
        title: 'Error',
        description: 'Failed to add SMTP provider',
        variant: 'destructive',
      });
    }
  };

  const deleteProvider = async (id: string) => {
    try {
      const { error } = await supabase
        .from('smtp_provider_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'SMTP provider deleted successfully',
      });

      fetchProviders();
    } catch (error) {
      console.error('Error deleting SMTP provider:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete SMTP provider',
        variant: 'destructive',
      });
    }
  };

  const testProvider = async (provider: SMTPProvider) => {
    setIsTestingProvider(provider.id);
    try {
      const { data, error } = await supabase.functions.invoke('smtp-health-monitor', {
        body: { providerId: provider.id }
      });

      if (error) throw error;

      toast({
        title: 'Test Result',
        description: data.healthy 
          ? `Connection successful in ${data.connectionTime}ms` 
          : `Connection failed: ${data.error}`,
        variant: data.healthy ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error testing provider:', error);
      toast({
        title: 'Test Failed',
        description: 'Failed to test SMTP provider',
        variant: 'destructive',
      });
    } finally {
      setIsTestingProvider(null);
    }
  };

  const toggleProviderStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('smtp_provider_configs')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Provider ${isActive ? 'activated' : 'deactivated'} successfully`,
      });

      fetchProviders();
    } catch (error) {
      console.error('Error updating provider status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update provider status',
        variant: 'destructive',
      });
    }
  };

  const setPrimaryProvider = async (id: string) => {
    try {
      // Remove primary from all providers
      await supabase
        .from('smtp_provider_configs')
        .update({ is_primary: false })
        .neq('id', '');

      // Set this provider as primary
      const { error } = await supabase
        .from('smtp_provider_configs')
        .update({ is_primary: true })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Primary provider updated successfully',
      });

      fetchProviders();
    } catch (error) {
      console.error('Error setting primary provider:', error);
      toast({
        title: 'Error',
        description: 'Failed to set primary provider',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const getHealthBadge = (healthScore: number, consecutiveFailures: number) => {
    if (consecutiveFailures > 5) {
      return <Badge variant="destructive">Critical</Badge>;
    }
    if (healthScore >= 80) {
      return <Badge variant="default">Healthy</Badge>;
    }
    if (healthScore >= 60) {
      return <Badge variant="secondary">Warning</Badge>;
    }
    return <Badge variant="destructive">Unhealthy</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Production SMTP Settings</h2>
          <p className="text-muted-foreground">
            Configure multiple SMTP providers with automatic failover and health monitoring
          </p>
        </div>
        <Button onClick={() => setShowAddProvider(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">SMTP Providers</TabsTrigger>
          <TabsTrigger value="settings">Advanced Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          {/* Provider List */}
          <div className="space-y-4">
            {providers.map((provider) => (
              <Card key={provider.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Server className="h-5 w-5" />
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription>
                          {provider.host}:{provider.port}
                          {provider.username && ` (${provider.username})`}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {provider.is_primary && (
                        <Badge variant="default">Primary</Badge>
                      )}
                      {getHealthBadge(provider.health_score, provider.consecutive_failures)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Health Score</Label>
                      <div className="text-lg font-semibold">{provider.health_score}%</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Daily Limit</Label>
                      <div className="text-lg font-semibold">{provider.daily_limit.toLocaleString()}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Hourly Limit</Label>
                      <div className="text-lg font-semibold">{provider.hourly_limit.toLocaleString()}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Priority</Label>
                      <div className="text-lg font-semibold">{provider.priority}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={provider.is_active}
                      onCheckedChange={(checked) => toggleProviderStatus(provider.id, checked)}
                    />
                    <Label>Active</Label>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testProvider(provider)}
                      disabled={isTestingProvider === provider.id}
                      className="ml-4"
                    >
                      {isTestingProvider === provider.id ? (
                        'Testing...'
                      ) : (
                        <>
                          <TestTube className="h-4 w-4 mr-1" />
                          Test
                        </>
                      )}
                    </Button>

                    {!provider.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrimaryProvider(provider.id)}
                      >
                        Set as Primary
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteProvider(provider.id)}
                      className="ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {provider.consecutive_failures > 0 && (
                    <Alert className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {provider.consecutive_failures} consecutive failures detected. 
                        Last health check: {new Date(provider.last_health_check).toLocaleString()}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}

            {providers.length === 0 && !isLoading && (
              <Card>
                <CardContent className="text-center py-8">
                  <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No SMTP Providers Configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first SMTP provider to enable email delivery with failover protection.
                  </p>
                  <Button onClick={() => setShowAddProvider(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Provider
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Add Provider Form */}
          {showAddProvider && (
            <Card>
              <CardHeader>
                <CardTitle>Add SMTP Provider</CardTitle>
                <CardDescription>
                  Configure a new SMTP provider for your email delivery system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmitProvider)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Provider Name</Label>
                      <Input
                        id="name"
                        {...register('name')}
                        placeholder="e.g., SendGrid, Amazon SES"
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="host">SMTP Host</Label>
                      <Input
                        id="host"
                        {...register('host')}
                        placeholder="smtp.example.com"
                      />
                      {errors.host && (
                        <p className="text-sm text-destructive mt-1">{errors.host.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        {...register('port', { valueAsNumber: true })}
                        placeholder="587"
                      />
                      {errors.port && (
                        <p className="text-sm text-destructive mt-1">{errors.port.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Input
                        id="priority"
                        type="number"
                        {...register('priority', { valueAsNumber: true })}
                        placeholder="1"
                      />
                      <p className="text-xs text-muted-foreground">Lower numbers = higher priority</p>
                    </div>

                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        {...register('username')}
                        placeholder="your-username"
                      />
                    </div>

                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        {...register('password')}
                        placeholder="your-password"
                      />
                    </div>

                    <div>
                      <Label htmlFor="daily_limit">Daily Limit</Label>
                      <Input
                        id="daily_limit"
                        type="number"
                        {...register('daily_limit', { valueAsNumber: true })}
                        placeholder="1000"
                      />
                    </div>

                    <div>
                      <Label htmlFor="hourly_limit">Hourly Limit</Label>
                      <Input
                        id="hourly_limit"
                        type="number"
                        {...register('hourly_limit', { valueAsNumber: true })}
                        placeholder="100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch {...register('is_primary')} />
                      <Label>Set as Primary Provider</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch {...register('is_active')} />
                      <Label>Active</Label>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Adding...' : 'Add Provider'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddProvider(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Configuration</CardTitle>
              <CardDescription>
                Configure advanced SMTP settings and monitoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Production Features Active:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Automatic failover between providers</li>
                    <li>Health monitoring every 5 minutes</li>
                    <li>Reputation-based rate limiting</li>
                    <li>Bounce and complaint tracking</li>
                    <li>Connection pooling and retry logic</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Health Check Thresholds</h4>
                  <div className="space-y-2 text-sm">
                    <div>Connection timeout: 30 seconds</div>
                    <div>Health check interval: 5 minutes</div>
                    <div>Minimum health score: 50%</div>
                    <div>Failover trigger: 3 consecutive failures</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Rate Limiting Tiers</h4>
                  <div className="space-y-2 text-sm">
                    <div>New: 10/hour, 50/day</div>
                    <div>Bronze: 50/hour, 200/day</div>
                    <div>Silver: 100/hour, 500/day</div>
                    <div>Gold: 250/hour, 1000/day</div>
                    <div>Platinum: 500/hour, 2000/day</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};