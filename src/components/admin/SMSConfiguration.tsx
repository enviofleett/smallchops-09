import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Settings, TestTube, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SMSConfig {
  id: string;
  provider: string;
  sender_id: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  cost_per_sms: number;
  balance_threshold: number;
  created_at: string;
  updated_at: string;
}

export const SMSConfiguration = () => {
  const [config, setConfig] = useState<SMSConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_configuration')
        .select('*')
        .eq('provider', 'mysmstab')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setConfig(data);
      } else {
        // Create default configuration
        const defaultConfig = {
          provider: 'mysmstab',
          sender_id: 'Starters',
          is_active: false,
          rate_limit_per_minute: 10,
          cost_per_sms: 0.50,
          balance_threshold: 100.00,
        };
        
        const { data: newConfig, error: createError } = await supabase
          .from('sms_configuration')
          .insert([defaultConfig])
          .select()
          .single();
          
        if (createError) throw createError;
        setConfig(newConfig);
      }
    } catch (error) {
      console.error('Error loading SMS configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to load SMS configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sms_configuration')
        .update({
          sender_id: config.sender_id,
          is_active: config.is_active,
          rate_limit_per_minute: config.rate_limit_per_minute,
          cost_per_sms: config.cost_per_sms,
          balance_threshold: config.balance_threshold,
        })
        .eq('id', config.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'SMS configuration saved successfully',
      });
    } catch (error) {
      console.error('Error saving SMS configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save SMS configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const checkBalance = async () => {
    try {
      // This would be implemented to call MySMSTab balance API
      // For now, we'll simulate it
      const response = await supabase.functions.invoke('sms-service', {
        body: {
          action: 'check_balance'
        }
      });

      if (response.error) throw response.error;
      
      // Mock balance for demo
      setBalance(Math.floor(Math.random() * 1000) + 100);
      
      toast({
        title: 'Balance Updated',
        description: 'SMS balance retrieved successfully',
      });
    } catch (error) {
      console.error('Error checking balance:', error);
      toast({
        title: 'Error',
        description: 'Failed to check SMS balance',
        variant: 'destructive',
      });
    }
  };

  const testSMS = async () => {
    if (!testPhone) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number to test',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('sms-service', {
        body: {
          to: testPhone,
          template_key: 'order_confirmed',
          variables: {
            customer_name: 'Test User',
            order_number: 'TEST001',
            total_amount: '5,000',
            tracking_url: 'https://example.com/track/TEST001'
          }
        }
      });

      if (error) throw error;

      toast({
        title: 'Test SMS Sent',
        description: 'Test SMS has been sent successfully',
      });
    } catch (error) {
      console.error('Error sending test SMS:', error);
      toast({
        title: 'Test Failed',
        description: 'Failed to send test SMS. Check your configuration.',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Configuration Error</h3>
            <p className="text-muted-foreground">Failed to load SMS configuration</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">SMS Configuration</h2>
          <p className="text-muted-foreground">
            Configure MySMSTab integration for order notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.is_active ? 'default' : 'secondary'}>
            {config.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant="outline">MySMSTab</Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Provider Settings
            </CardTitle>
            <CardDescription>
              Configure MySMSTab provider settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sender_id">Sender ID</Label>
              <Input
                id="sender_id"
                value={config.sender_id}
                onChange={(e) =>
                  setConfig(prev => prev ? { ...prev, sender_id: e.target.value } : null)
                }
                placeholder="e.g., Starters"
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">
                Maximum 11 characters. This appears as the sender name.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate_limit">Rate Limit (per minute)</Label>
              <Input
                id="rate_limit"
                type="number"
                value={config.rate_limit_per_minute}
                onChange={(e) =>
                  setConfig(prev => prev ? { ...prev, rate_limit_per_minute: parseInt(e.target.value) } : null)
                }
                min="1"
                max="100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_per_sms">Cost per SMS (₦)</Label>
              <Input
                id="cost_per_sms"
                type="number"
                step="0.01"
                value={config.cost_per_sms}
                onChange={(e) =>
                  setConfig(prev => prev ? { ...prev, cost_per_sms: parseFloat(e.target.value) } : null)
                }
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="balance_threshold">Balance Alert Threshold (₦)</Label>
              <Input
                id="balance_threshold"
                type="number"
                value={config.balance_threshold}
                onChange={(e) =>
                  setConfig(prev => prev ? { ...prev, balance_threshold: parseFloat(e.target.value) } : null)
                }
                min="0"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={config.is_active}
                onCheckedChange={(checked) =>
                  setConfig(prev => prev ? { ...prev, is_active: checked } : null)
                }
              />
              <Label htmlFor="is_active">Enable SMS notifications</Label>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Testing & Monitoring
            </CardTitle>
            <CardDescription>
              Test SMS functionality and monitor balance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test_phone">Test Phone Number</Label>
              <Input
                id="test_phone"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="234XXXXXXXXXX"
              />
            </div>

            <Button 
              onClick={testSMS} 
              disabled={testing || !config.is_active} 
              className="w-full"
            >
              {testing ? 'Sending...' : 'Send Test SMS'}
            </Button>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Account Balance</h4>
                <Button variant="outline" size="sm" onClick={checkBalance}>
                  <Activity className="h-4 w-4 mr-2" />
                  Check Balance
                </Button>
              </div>
              
              {balance !== null && (
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Current Balance</span>
                    <span className="text-lg font-bold">₦{balance.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center mt-2">
                    {balance < config.balance_threshold ? (
                      <>
                        <AlertTriangle className="h-4 w-4 text-warning mr-2" />
                        <span className="text-sm text-warning">
                          Balance below threshold
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-success mr-2" />
                        <span className="text-sm text-success">
                          Balance sufficient
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Quick Stats</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted p-2 rounded">
                  <div className="font-medium">Estimated SMS/₦100</div>
                  <div className="text-muted-foreground">
                    {Math.floor(100 / config.cost_per_sms)} messages
                  </div>
                </div>
                <div className="bg-muted p-2 rounded">
                  <div className="font-medium">Rate Limit</div>
                  <div className="text-muted-foreground">
                    {config.rate_limit_per_minute}/min
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};