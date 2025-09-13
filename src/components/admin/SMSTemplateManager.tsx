import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { FileText, Plus, Edit, Trash2, Eye, Copy, AlertTriangle } from 'lucide-react'

interface SMSTemplate {
  id: string
  name: string
  event_type: string
  template_content: string
  variables: string[]
  is_active: boolean
  character_count: number
}

export default function SMSTemplateManager() {
  const [templates, setTemplates] = useState<SMSTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<SMSTemplate | null>(null)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const { toast } = useToast()

  const eventTypes = [
    { value: 'order_status_sms', label: 'Order Status Update' },
    { value: 'payment_confirmation_sms', label: 'Payment Confirmation' },
    { value: 'welcome_sms', label: 'Welcome Message' },
    { value: 'order_ready_sms', label: 'Order Ready' },
    { value: 'order_completed_sms', label: 'Order Completed' },
    { value: 'order_cancelled_sms', label: 'Order Cancelled' },
    { value: 'delivery_scheduled_sms', label: 'Delivery Scheduled' },
    { value: 'custom_sms', label: 'Custom Template' }
  ]

  const defaultTemplates: Record<string, SMSTemplate> = {
    order_status_sms: {
      id: 'default_order_status',
      name: 'Order Status Update',
      event_type: 'order_status_sms',
      template_content: 'Hi {{customerName}}, your order {{orderNumber}} status: {{orderStatus}}. Track: {{trackingUrl}}',
      variables: ['customerName', 'orderNumber', 'orderStatus', 'trackingUrl'],
      is_active: true,
      character_count: 0
    },
    payment_confirmation_sms: {
      id: 'default_payment',
      name: 'Payment Confirmation',
      event_type: 'payment_confirmation_sms',
      template_content: 'Hi {{customerName}}, payment confirmed for order {{orderNumber}}. Amount: {{orderTotal}}. Thanks!',
      variables: ['customerName', 'orderNumber', 'orderTotal'],
      is_active: true,
      character_count: 0
    },
    welcome_sms: {
      id: 'default_welcome',
      name: 'Welcome Message',
      event_type: 'welcome_sms',
      template_content: 'Welcome {{customerName}}! Thanks for joining {{companyName}}. Start shopping: {{shopUrl}}',
      variables: ['customerName', 'companyName', 'shopUrl'],
      is_active: true,
      character_count: 0
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setIsLoading(true)
    try {
      // For now, use default templates. In a real implementation, this would load from database
      const loadedTemplates = Object.values(defaultTemplates).map(template => ({
        ...template,
        character_count: template.template_content.length
      }))
      setTemplates(loadedTemplates)
    } catch (error) {
      console.error('Error loading SMS templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveTemplate = async (template: SMSTemplate) => {
    try {
      // Validate template
      if (!template.name.trim()) {
        throw new Error('Template name is required')
      }
      if (!template.template_content.trim()) {
        throw new Error('Template content is required')
      }
      if (template.template_content.length > 160) {
        throw new Error('Template content must be 160 characters or less')
      }

      // In a real implementation, this would save to database
      const updatedTemplate = {
        ...template,
        character_count: template.template_content.length,
        variables: extractVariables(template.template_content)
      }

      if (isCreateMode) {
        updatedTemplate.id = `custom_${Date.now()}`
        setTemplates(prev => [...prev, updatedTemplate])
      } else {
        setTemplates(prev => prev.map(t => t.id === template.id ? updatedTemplate : t))
      }

      toast({
        title: 'Template Saved',
        description: isCreateMode ? 'New SMS template created' : 'SMS template updated',
      })

      setEditingTemplate(null)
      setIsCreateMode(false)
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const deleteTemplate = async (templateId: string) => {
    try {
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      toast({
        title: 'Template Deleted',
        description: 'SMS template has been deleted',
      })
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const duplicateTemplate = (template: SMSTemplate) => {
    const duplicated = {
      ...template,
      id: `duplicate_${Date.now()}`,
      name: `${template.name} (Copy)`,
      is_active: false
    }
    setEditingTemplate(duplicated)
    setIsCreateMode(true)
  }

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g)
    return matches ? matches.map(match => match.replace(/[{}]/g, '')) : []
  }

  const renderTemplatePreview = (template: SMSTemplate) => {
    let preview = template.template_content
    template.variables.forEach(variable => {
      const placeholder = `{{${variable}}}`
      const sampleValue = getSampleValue(variable)
      preview = preview.replace(new RegExp(placeholder, 'g'), sampleValue)
    })
    return preview
  }

  const getSampleValue = (variable: string): string => {
    const sampleValues: Record<string, string> = {
      customerName: 'John Doe',
      orderNumber: 'ORD-001',
      orderStatus: 'Preparing',
      orderTotal: '₦5,000',
      trackingUrl: 'bit.ly/track123',
      companyName: 'Starters',
      shopUrl: 'starterssmallchops.com'
    }
    return sampleValues[variable] || `[${variable}]`
  }

  return (
    <div className="space-y-6">
      {/* Header and Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SMS Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage SMS message templates for different event types
          </p>
        </div>
        <Button onClick={() => { setIsCreateMode(true); setEditingTemplate({
          id: '',
          name: '',
          event_type: 'custom_sms',
          template_content: '',
          variables: [],
          is_active: true,
          character_count: 0
        })}}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Templates List */}
      <div className="grid gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{template.name}</h4>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">
                        {eventTypes.find(et => et.value === template.event_type)?.label || template.event_type}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="font-mono bg-muted p-2 rounded text-xs">
                        {template.template_content}
                      </p>
                      <div className="flex items-center gap-4">
                        <span>Characters: {template.character_count}/160</span>
                        <span>Variables: {template.variables.join(', ') || 'None'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewTemplate(template)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateTemplate(template)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingTemplate(template); setIsCreateMode(false) }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!template.id.startsWith('default_') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit/Create Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto">
            <CardHeader className="border-b">
              <CardTitle>
                {isCreateMode ? 'Create SMS Template' : 'Edit SMS Template'}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-4"
                onClick={() => { setEditingTemplate(null); setIsCreateMode(false) }}
              >
                ×
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name</Label>
                <Input
                  id="templateName"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder="Enter template name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type</Label>
                <Select 
                  value={editingTemplate.event_type} 
                  onValueChange={(value) => setEditingTemplate(prev => prev ? {...prev, event_type: value} : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateContent">Message Content</Label>
                <Textarea
                  id="templateContent"
                  value={editingTemplate.template_content}
                  onChange={(e) => setEditingTemplate(prev => prev ? {
                    ...prev, 
                    template_content: e.target.value,
                    character_count: e.target.value.length,
                    variables: extractVariables(e.target.value)
                  } : null)}
                  placeholder="Enter your SMS message with variables like {{customerName}}"
                  rows={4}
                  maxLength={160}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Use {{variableName}} for dynamic content</span>
                  <span className={editingTemplate.character_count > 160 ? 'text-red-600' : ''}>
                    {editingTemplate.character_count}/160 characters
                  </span>
                </div>
              </div>

              {editingTemplate.variables.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Variables found:</strong> {editingTemplate.variables.join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={() => saveTemplate(editingTemplate)}>
                  {isCreateMode ? 'Create Template' : 'Save Changes'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => { setEditingTemplate(null); setIsCreateMode(false) }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview Template Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full">
            <CardHeader className="border-b">
              <CardTitle>Template Preview</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-4"
                onClick={() => setPreviewTemplate(null)}
              >
                ×
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-sm font-medium mb-2">Template: {previewTemplate.name}</p>
                <div className="bg-muted p-3 rounded">
                  <p className="text-sm font-mono">{renderTemplatePreview(previewTemplate)}</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Character count: {renderTemplatePreview(previewTemplate).length}/160</p>
                <p>Variables used: {previewTemplate.variables.join(', ') || 'None'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}