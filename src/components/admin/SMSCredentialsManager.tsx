import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Shield, Lock, CheckCircle, XCircle, MessageSquare, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface SMSCredentials {
  name: string
  isSet: boolean
  masked?: string
}

interface SMSProviderSettings {
  id: string
  provider_name: string
  api_endpoint: string
  sender_id: string
  is_active: boolean
  wallet_balance: number
  last_balance_check: string
  settings: any
}

export default function SMSCredentialsManager() {
  const [credentials, setCredentials] = useState<SMSCredentials[]>([])
  const [providerSettings, setProviderSettings] = useState<SMSProviderSettings | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isProductionReady, setIsProductionReady] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [formData, setFormData] = useState({
    senderId: '',
    apiEndpoint: 'https://api.mysmstab.com/v1/sms/send',
    isActive: true
  })
  const { toast } = useToast()

  useEffect(() => {
    loadSMSSettings()
    checkCredentialsStatus()
  }, [])

  const loadSMSSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_provider_settings')
        .select('*')
        .eq('provider_name', 'mysmstab')
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading SMS settings:', error)
        return
      }

      if (data) {
        setProviderSettings(data)
        setFormData({
          senderId: data.sender_id || '',
          apiEndpoint: data.api_endpoint || 'https://api.mysmstab.com/v1/sms/send',
          isActive: data.is_active
        })
      }
    } catch (error) {
      console.error('Error loading SMS settings:', error)
    }
  }

  const checkCredentialsStatus = async () => {
    try {
      // Check function secrets availability
      const { data, error } = await supabase.functions.invoke('business-settings', {
        body: { action: 'check_sms_credentials' }
      })

      if (error) {
        console.error('Error checking SMS credentials:', error)
        setCredentials([])
        return
      }

      const coreCredentials = ['MYSMSTAB_API_KEY', 'MYSMSTAB_SENDER_ID']
      const statusList = coreCredentials.map(name => ({
        name,
        isSet: data?.success && data?.sms_credentials?.includes(name),
        masked: data?.success && data?.sms_credentials?.includes(name) ? '✓ Configured in Function Secrets' : undefined
      }))

      setCredentials(statusList)
      setIsProductionReady(statusList.every(cred => cred.isSet))
    } catch (error) {
      console.error('Error checking credentials:', error)
      setCredentials([])
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Update or insert SMS provider settings
      const { error } = await supabase
        .from('sms_provider_settings')
        .upsert({
          provider_name: 'mysmstab',
          api_endpoint: formData.apiEndpoint,
          sender_id: formData.senderId,
          is_active: formData.isActive,
          settings: {
            max_retries: 3,
            retry_delay_seconds: 60,
            rate_limit_per_minute: 60,
            webhook_enabled: true
          },
          updated_at: new Date().toISOString()
        })

      if (error) {
        throw error
      }

      toast({
        title: 'Settings Saved',
        description: 'SMS provider settings have been updated successfully.',
      })

      await loadSMSSettings()
    } catch (error: any) {
      console.error('Error saving SMS settings:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to save SMS settings',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const testSMSConnection = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('sms-sender', {
        body: { 
          test: true,
          phone: '+234', // Test with a placeholder number
          message: 'Test SMS from Starters Admin Panel'
        }
      })

      if (error) {
        throw error
      }

      toast({
        title: 'SMS Test',
        description: data.success ? 'SMS service is working correctly!' : 'SMS test failed',
        variant: data.success ? 'default' : 'destructive'
      })
    } catch (error: any) {
      toast({
        title: 'SMS Test Failed',
        description: error.message || 'Failed to test SMS connection',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const checkBalance = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('business-settings', {
        body: { action: 'check_sms_balance' }
      })

      if (error) {
        throw error
      }

      if (data.success) {
        setProviderSettings(prev => prev ? {
          ...prev,
          wallet_balance: data.balance,
          last_balance_check: new Date().toISOString()
        } : null)

        toast({
          title: 'Balance Updated',
          description: `Current balance: ₦${data.balance}`,
        })
      }
    } catch (error: any) {
      toast({
        title: 'Balance Check Failed',
        description: error.message || 'Failed to check SMS balance',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          SMS Configuration
        </h2>
        <p className="text-muted-foreground">
          Configure SMS credentials and settings for customer notifications
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SMS Service Status
          </CardTitle>
          <CardDescription>
            Current status of SMS credentials and service configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isProductionReady && (
            <Alert className="mb-4 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>SMS Service Not Configured:</strong> SMS credentials must be configured via Edge Function Secrets.
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

          <div className="space-y-3">
            {credentials.map((cred) => (
              <div key={cred.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {cred.isSet ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium">{cred.name}</p>
                    {cred.masked && (
                      <p className="text-sm text-muted-foreground">{cred.masked}</p>
                    )}
                  </div>
                </div>
                <Badge variant={cred.isSet ? 'default' : 'destructive'}>
                  {cred.isSet ? 'Configured' : 'Missing'}
                </Badge>
              </div>
            ))}
          </div>

          {providerSettings && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Provider</p>
                  <p className="text-muted-foreground">MySmstab.com</p>
                </div>
                <div>
                  <p className="font-medium">Status</p>
                  <Badge variant={providerSettings.is_active ? 'default' : 'destructive'}>
                    {providerSettings.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium">Sender ID</p>
                  <p className="text-muted-foreground">{providerSettings.sender_id || 'Not set'}</p>
                </div>
                <div>
                  <p className="font-medium">Wallet Balance</p>
                  <p className="text-muted-foreground">
                    ₦{providerSettings.wallet_balance || 'Unknown'}
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={checkBalance}
                      disabled={isLoading}
                      className="ml-2 p-0 h-auto"
                    >
                      Refresh
                    </Button>
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle>SMS Provider Settings</CardTitle>
          <CardDescription>
            Configure your MySmstab.com SMS provider settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senderId">Sender ID</Label>
            <Input
              id="senderId"
              value={formData.senderId}
              onChange={(e) => setFormData(prev => ({ ...prev, senderId: e.target.value }))}
              placeholder="e.g., Starters, YourBrand"
              maxLength={11}
            />
            <p className="text-sm text-muted-foreground">
              The name that appears as the sender (max 11 characters)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiEndpoint">API Endpoint</Label>
            <Input
              id="apiEndpoint"
              value={formData.apiEndpoint}
              onChange={(e) => setFormData(prev => ({ ...prev, apiEndpoint: e.target.value }))}
              placeholder="https://api.mysmstab.com/v1/sms/send"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor="isActive">Enable SMS Service</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSave} 
              disabled={isLoading}
            >
              Save Settings
            </Button>
            <Button 
              variant="outline" 
              onClick={testSMSConnection} 
              disabled={isLoading || !isProductionReady}
            >
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Credentials Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Function Secrets Setup
          </CardTitle>
          <CardDescription>
            Required environment variables for SMS functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                For security, SMS API credentials must be configured as Supabase Function Secrets.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div>
                <p className="font-medium">Required Secrets:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-2">
                  <li><code>MYSMSTAB_API_KEY</code> - Your MySmstab.com API key</li>
                  <li><code>MYSMSTAB_SENDER_ID</code> - Your registered sender ID</li>
                  <li><code>MYSMSTAB_API_ENDPOINT</code> - API endpoint (optional, defaults to standard endpoint)</li>
                </ul>
              </div>

              <div>
                <p className="font-medium">Setup Instructions:</p>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 mt-2">
                  <li>Go to your Supabase project dashboard</li>
                  <li>Navigate to Edge Functions → Manage Secrets</li>
                  <li>Add the required secrets with your MySmstab.com credentials</li>
                  <li>Deploy your functions to apply the new secrets</li>
                </ol>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full">
              <a 
                href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Function Secrets Manager
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}