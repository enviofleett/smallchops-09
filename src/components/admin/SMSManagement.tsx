import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { MessageSquare, Send, Settings, Users, AlertTriangle, CheckCircle } from 'lucide-react'

interface SMSProvider {
  id: string
  provider_name: string
  api_key?: string
  api_secret?: string
  api_username?: string
  api_password?: string
  base_url?: string
  sender_id?: string
  default_sender?: string
  is_active: boolean
}

interface SMSTemplate {
  id: string
  name: string
  template_key: string
  content: string
  variables: string[]
  template_type: string
  is_active: boolean
}

interface SMSStats {
  totalSent: number
  deliveryRate: number
  failureRate: number
  walletBalance: number
}

export const SMSManagement = () => {
  const { toast } = useToast()
  const [providers, setProviders] = useState<SMSProvider[]>([])
  const [templates, setTemplates] = useState<SMSTemplate[]>([])
  const [stats, setStats] = useState<SMSStats>({
    totalSent: 0,
    deliveryRate: 0,
    failureRate: 0,
    walletBalance: 0
  })
  const [loading, setLoading] = useState(true)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('This is a test SMS from your system.')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    fetchSMSData()
  }, [])

  const fetchSMSData = async () => {
    try {
      setLoading(true)
      
      // Fetch SMS provider settings from database
      const { data: providerData, error: providerError } = await supabase
        .from('sms_provider_settings')
        .select('*')
        .eq('provider_name', 'MySMSTab')
        .single()

      let provider: SMSProvider
      if (providerError || !providerData) {
        // Default provider if not found
        provider = {
          id: '1',
          provider_name: 'MySMSTab',
          api_username: '',
          api_password: '',
          base_url: 'https://sms.mysmstab.com/api/',
          default_sender: 'MySMSTab',
          is_active: false
        }
      } else {
        provider = {
          id: providerData.id,
          provider_name: providerData.provider_name,
          api_username: providerData.username || '',
          api_password: providerData.password || '',
          base_url: 'https://sms.mysmstab.com/api/',
          default_sender: providerData.default_sender || 'MySMSTab',
          is_active: providerData.is_active || false
        }
      }

      // Mock templates for now
      const mockTemplates: SMSTemplate[] = [
        {
          id: '1',
          name: 'Order Confirmation SMS',
          template_key: 'order_confirmation_sms',
          content: 'Hi {{customerName}}! Your order {{orderNumber}} has been confirmed. Total: ₦{{totalAmount}}. Thank you!',
          variables: ['customerName', 'orderNumber', 'totalAmount'],
          template_type: 'transactional',
          is_active: true
        },
        {
          id: '2',
          name: 'Order Ready SMS',
          template_key: 'order_ready_sms',
          content: 'Hi {{customerName}}! Your order {{orderNumber}} is ready for pickup/delivery. Contact us for details.',
          variables: ['customerName', 'orderNumber'],
          template_type: 'transactional',
          is_active: true
        }
      ]

      setProviders([provider])
      setTemplates(mockTemplates)
      setStats({
        totalSent: 0,
        deliveryRate: 0,
        failureRate: 0,
        walletBalance: 0
      })

    } catch (error) {
      console.error('Error fetching SMS data:', error)
      toast({
        title: "Info",
        description: "SMS system initializing - data will be available after setup",
        variant: "default"
      })
    } finally {
      setLoading(false)
    }
  }

  const updateProvider = (providerId: string, updates: Partial<SMSProvider>) => {
    // Update local state only (don't save to database yet)
    setProviders(prev => 
      prev.map(provider => 
        provider.id === providerId 
          ? { ...provider, ...updates }
          : provider
      )
    )
    setHasUnsavedChanges(true)
  }

  const saveProviderChanges = async () => {
    try {
      setIsSaving(true)
      
      // Save all providers to database
      for (const provider of providers) {
        const { error } = await supabase
          .from('sms_provider_settings')
          .upsert({
            provider_name: provider.provider_name,
            username: provider.api_username,
            password: provider.api_password,
            default_sender: provider.default_sender || 'MySMSTab',
            is_active: provider.is_active ?? false,
            updated_at: new Date().toISOString()
          })

        if (error) throw error
      }

      setHasUnsavedChanges(false)
      toast({
        title: "Success",
        description: "SMS provider settings saved successfully"
      })
      
    } catch (error) {
      console.error('Error saving provider settings:', error)
      toast({
        title: "Error",
        description: "Failed to save SMS provider settings",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const sendTestSMS = async () => {
    if (!testPhone || !testMessage) {
      toast({
        title: "Error",
        description: "Please enter both phone number and message",
        variant: "destructive"
      })
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('mysmstab-sms', {
        body: {
          phoneNumber: testPhone,
          message: testMessage,
          sender: 'Test'
        }
      })

      if (error) throw error

      if (data?.success) {
        toast({
          title: "Success",
          description: data.message || "Test SMS sent successfully"
        })
        setTestPhone('')
        setTestMessage('This is a test SMS from your system.')
        fetchSMSData()
      } else {
        throw new Error(data?.message || data?.error || 'SMS sending failed')
      }
    } catch (error) {
      console.error('Error sending test SMS:', error)
      toast({
        title: "Error",
        description: `Failed to send test SMS: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const checkBalance = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('mysmstab-sms', {
        body: {
          checkBalance: true
        }
      })

      if (error) throw error

      if (data?.success) {
        toast({
          title: "Balance Check Complete",
          description: `Current balance: ${data.data?.balance || 'N/A'} ${data.data?.currency || 'NGN'}`
        })
        fetchSMSData() // Refresh data to show updated balance
      } else {
        throw new Error(data?.message || data?.error || 'Balance check failed')
      }
    } catch (error) {
      console.error('Error checking balance:', error)
      toast({
        title: "Error",
        description: `Failed to check balance: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const processSMSQueue = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sms-processor')

      if (error) throw error

      toast({
        title: "Success",
        description: `Processed ${data.processed || 0} SMS messages`
      })
      
      fetchSMSData()
    } catch (error) {
      console.error('Error processing SMS queue:', error)
      toast({
        title: "Error",
        description: "Failed to process SMS queue",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading SMS Management...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Total Sent (30d)</p>
                <p className="text-2xl font-bold">{stats.totalSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Delivery Rate</p>
                <p className="text-2xl font-bold">{stats.deliveryRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Failure Rate</p>
                <p className="text-2xl font-bold">{stats.failureRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Wallet Balance</p>
                <p className="text-2xl font-bold">₦{stats.walletBalance.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">SMS Providers</h3>
            <div className="space-x-2">
              <Button 
                onClick={saveProviderChanges} 
                disabled={!hasUnsavedChanges || isSaving}
                variant={hasUnsavedChanges ? "default" : "outline"}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Button onClick={checkBalance} variant="outline">
                Check Balance  
              </Button>
              <Button onClick={processSMSQueue} variant="outline">
                Process Queue
              </Button>
            </div>
          </div>
          
          {hasUnsavedChanges && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">You have unsaved changes. Click "Save Changes" to apply them.</span>
              </div>
            </div>
          )}
          
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {provider.provider_name}
                  </CardTitle>
                  <Badge variant={provider.is_active ? "default" : "secondary"}>
                    {provider.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>
                  Configure your {provider.provider_name} SMS provider settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`username_${provider.id}`}>Username</Label>
                    <Input
                      id={`username_${provider.id}`}
                      value={provider.api_username || ''}
                      placeholder="Enter MySMSTab username"
                      onChange={(e) => updateProvider(provider.id, { api_username: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`password_${provider.id}`}>Password</Label>
                    <Input
                      id={`password_${provider.id}`}
                      type="password"
                      value={provider.api_password || ''}
                      placeholder="Enter MySMSTab password"
                      onChange={(e) => updateProvider(provider.id, { api_password: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`base_url_${provider.id}`}>API URL</Label>
                    <Input
                      id={`base_url_${provider.id}`}
                      value={provider.base_url || ''}
                      placeholder="https://sms.mysmstab.com/api/"
                      onChange={(e) => updateProvider(provider.id, { base_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`default_sender_${provider.id}`}>Default Sender</Label>
                    <Input
                      id={`default_sender_${provider.id}`}
                      value={provider.default_sender || ''}
                      placeholder="MySMSTab"
                      onChange={(e) => updateProvider(provider.id, { default_sender: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`active_${provider.id}`}
                    checked={provider.is_active}
                    onCheckedChange={(checked) => updateProvider(provider.id, { is_active: checked })}
                  />
                  <Label htmlFor={`active_${provider.id}`}>Enable this provider</Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <h3 className="text-lg font-semibold">SMS Templates</h3>
          
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{template.name}</CardTitle>
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>
                  Template Key: {template.template_key} | Type: {template.template_type}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={template.content}
                    readOnly
                    className="bg-muted"
                  />
                  {template.variables.length > 0 && (
                    <div>
                      <Label>Available Variables</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="outline">
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Test SMS
              </CardTitle>
              <CardDescription>
                Test your SMS configuration by sending a message to any phone number
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="test_phone">Phone Number</Label>
                <Input
                  id="test_phone"
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="e.g., +2348012345678"
                />
              </div>
              <div>
                <Label htmlFor="test_message">Message</Label>
                <Textarea
                  id="test_message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter your test message..."
                />
              </div>
              <Button onClick={sendTestSMS} className="w-full">
                Send Test SMS
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}