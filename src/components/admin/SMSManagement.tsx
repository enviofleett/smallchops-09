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
  base_url?: string
  sender_id?: string
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

  useEffect(() => {
    fetchSMSData()
  }, [])

  const fetchSMSData = async () => {
    try {
      setLoading(true)
      
      // Mock data for SMS providers until migration completes
      const mockProviders: SMSProvider[] = [{
        id: '1',
        provider_name: 'MySMSTab',
        api_key: '',
        base_url: 'https://api.mysmstab.com',
        sender_id: '',
        is_active: false
      }]

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

      setProviders(mockProviders)
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

  const updateProvider = async (providerId: string, updates: Partial<SMSProvider>) => {
    try {
      // For now, just update local state until migration is complete
      setProviders(prev => 
        prev.map(provider => 
          provider.id === providerId 
            ? { ...provider, ...updates }
            : provider
        )
      )

      toast({
        title: "Success",
        description: "SMS provider settings saved locally"
      })
      
    } catch (error) {
      console.error('Error updating provider:', error)
      toast({
        title: "Info",
        description: "SMS system will be fully functional after migration completes",
        variant: "default"
      })
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

      if (data.success) {
        toast({
          title: "Success",
          description: "Test SMS sent successfully"
        })
        setTestPhone('')
        setTestMessage('This is a test SMS from your system.')
        fetchSMSData()
      } else {
        throw new Error(data.error || 'Unknown error')
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
            <Button onClick={processSMSQueue} variant="outline">
              Process Queue
            </Button>
          </div>
          
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
                    <Label htmlFor={`api_key_${provider.id}`}>API Key</Label>
                    <Input
                      id={`api_key_${provider.id}`}
                      type="password"
                      value={provider.api_key || ''}
                      placeholder="Enter API Key"
                      onChange={(e) => updateProvider(provider.id, { api_key: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`sender_id_${provider.id}`}>Sender ID</Label>
                    <Input
                      id={`sender_id_${provider.id}`}
                      value={provider.sender_id || ''}
                      placeholder="Enter Sender ID"
                      onChange={(e) => updateProvider(provider.id, { sender_id: e.target.value })}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor={`base_url_${provider.id}`}>Base URL</Label>
                  <Input
                    id={`base_url_${provider.id}`}
                    value={provider.base_url || ''}
                    placeholder="https://api.mysmstab.com"
                    onChange={(e) => updateProvider(provider.id, { base_url: e.target.value })}
                  />
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