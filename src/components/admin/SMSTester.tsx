import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { TestTube, Send, CheckCircle, XCircle, AlertTriangle, Phone, MessageSquare } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface TestResult {
  success: boolean
  message: string
  messageId?: string
  cost?: number
  error?: string
  timestamp: string
}

export default function SMSTester() {
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const { toast } = useToast()

  const sampleTemplates = [
    {
      value: 'test_basic',
      label: 'Basic Test',
      content: 'Hello! This is a test SMS from {{companyName}}. Time: {{timestamp}}'
    },
    {
      value: 'test_order',
      label: 'Order Test',
      content: 'Hi {{customerName}}, your order {{orderNumber}} is {{status}}. Thanks!'
    },
    {
      value: 'test_welcome',
      label: 'Welcome Test',
      content: 'Welcome to {{companyName}}! Your account is ready. Visit: {{shopUrl}}'
    },
    {
      value: 'custom',
      label: 'Custom Message',
      content: ''
    }
  ]

  const testConnectionOnly = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('sms-sender', {
        body: { 
          test_connection: true
        }
      })

      if (error) {
        throw error
      }

      if (data?.success) {
        setConnectionStatus('connected')
        toast({
          title: 'Connection Success',
          description: 'SMS provider connection is working correctly',
        })
      } else {
        setConnectionStatus('error')
        toast({
          title: 'Connection Failed',
          description: data?.error || 'SMS provider connection failed',
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      setConnectionStatus('error')
      toast({
        title: 'Connection Error',
        description: error.message || 'Failed to test SMS provider connection',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const sendTestSMS = async () => {
    if (!testPhone.trim()) {
      toast({
        title: 'Phone Required',
        description: 'Please enter a phone number for testing',
        variant: 'destructive'
      })
      return
    }

    if (!testMessage.trim()) {
      toast({
        title: 'Message Required',
        description: 'Please enter a test message',
        variant: 'destructive'
      })
      return
    }

    // Basic phone validation
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/
    if (!phoneRegex.test(testPhone.trim())) {
      toast({
        title: 'Invalid Phone',
        description: 'Please enter a valid phone number',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    try {
      // Prepare message with sample variables
      const messageWithVariables = testMessage
        .replace(/\{\{companyName\}\}/g, 'Starters')
        .replace(/\{\{timestamp\}\}/g, new Date().toLocaleTimeString())
        .replace(/\{\{customerName\}\}/g, 'Test User')
        .replace(/\{\{orderNumber\}\}/g, 'TEST-001')
        .replace(/\{\{status\}\}/g, 'processing')
        .replace(/\{\{shopUrl\}\}/g, 'starterssmallchops.com')

      const { data, error } = await supabase.functions.invoke('sms-sender', {
        body: { 
          test_sms: true,
          phone: testPhone.trim(),
          message: messageWithVariables
        }
      })

      const result: TestResult = {
        success: data?.success || false,
        message: data?.success ? 'SMS sent successfully' : 'SMS sending failed',
        messageId: data?.messageId,
        cost: data?.cost,
        error: error?.message || data?.error,
        timestamp: new Date().toISOString()
      }

      setTestResults(prev => [result, ...prev.slice(0, 9)]) // Keep last 10 results

      if (result.success) {
        toast({
          title: 'Test SMS Sent',
          description: `SMS sent to ${testPhone}${result.cost ? ` (Cost: ₦${result.cost})` : ''}`,
        })
      } else {
        toast({
          title: 'Test SMS Failed',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      const result: TestResult = {
        success: false,
        message: 'Network error',
        error: error.message,
        timestamp: new Date().toISOString()
      }

      setTestResults(prev => [result, ...prev.slice(0, 9)])

      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to send test SMS',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTemplateChange = (templateValue: string) => {
    setSelectedTemplate(templateValue)
    const template = sampleTemplates.find(t => t.value === templateValue)
    if (template && template.content) {
      setTestMessage(template.content)
    } else if (templateValue === 'custom') {
      setTestMessage('')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            SMS Service Test
          </CardTitle>
          <CardDescription>
            Test your SMS provider connection and send test messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">SMS Provider Connection</p>
              <p className="text-sm text-muted-foreground">
                Test connection to MySmstab.com API
              </p>
            </div>
            <div className="flex items-center gap-3">
              {connectionStatus === 'connected' && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
              {connectionStatus === 'error' && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Error
                </Badge>
              )}
              {connectionStatus === 'unknown' && (
                <Badge variant="outline">
                  Unknown
                </Badge>
              )}
              <Button 
                variant="outline" 
                onClick={testConnectionOnly}
                disabled={isLoading}
              >
                Test Connection
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test SMS Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Test SMS
          </CardTitle>
          <CardDescription>
            Send a test SMS to verify delivery and messaging
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="testPhone">Test Phone Number</Label>
              <Input
                id="testPhone"
                placeholder="+234 or 0 format"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use your own phone number for testing
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template">Message Template</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {sampleTemplates.map((template) => (
                    <SelectItem key={template.value} value={template.value}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="testMessage">Test Message</Label>
            <Textarea
              id="testMessage"
              placeholder="Enter your test message (variables like {{companyName}} will be replaced)"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={4}
              maxLength={160}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Variables: {{companyName}}, {{timestamp}}, {{customerName}}, etc.</span>
              <span className={testMessage.length > 160 ? 'text-red-600' : ''}>
                {testMessage.length}/160 characters
              </span>
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> Test SMS messages will incur actual charges from your SMS provider.
              Only use your own phone number for testing.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={sendTestSMS} 
            disabled={isLoading || !testPhone.trim() || !testMessage.trim()}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {isLoading ? 'Sending...' : 'Send Test SMS'}
          </Button>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Test Results
            </CardTitle>
            <CardDescription>
              Recent SMS test results and delivery status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{result.message}</p>
                      {result.error && (
                        <p className="text-sm text-red-600">{result.error}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{new Date(result.timestamp).toLocaleString()}</span>
                        {result.messageId && (
                          <span>ID: {result.messageId}</span>
                        )}
                        {result.cost && (
                          <span>{formatCurrency(result.cost)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={result.success ? 'default' : 'destructive'}>
                    {result.success ? 'Success' : 'Failed'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Testing Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Before Testing:</p>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                <li>Ensure SMS credentials are configured in Function Secrets</li>
                <li>Verify your SMS provider account has sufficient balance</li>
                <li>Use only your own phone number for testing</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">Test Types:</p>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                <li><strong>Connection Test:</strong> Verifies API connectivity without sending SMS</li>
                <li><strong>Message Test:</strong> Sends actual SMS to test delivery and formatting</li>
                <li><strong>Template Test:</strong> Tests variable replacement in message templates</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">Troubleshooting:</p>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                <li>Check Function Secrets if connection tests fail</li>
                <li>Verify phone number format (include country code)</li>
                <li>Ensure message length is under 160 characters</li>
                <li>Check SMS provider account balance and status</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}