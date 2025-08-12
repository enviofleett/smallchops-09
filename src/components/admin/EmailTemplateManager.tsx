import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Send, Eye, Save, Plus, Edit } from 'lucide-react';
import { sanitizeHtml } from '@/utils/htmlSanitizer';

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template: string;
  variables: string[];
  template_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: string;
  style?: string;
  created_by?: string;
}

export const EmailTemplateManager = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const { toast } = useToast();

  const templateTypes = [
    { key: 'order_confirmation', name: 'Order Confirmation' },
    { key: 'payment_confirmation', name: 'Payment Confirmation' },
    { key: 'customer_welcome', name: 'Welcome Email' },
    { key: 'order_shipped', name: 'Order Shipped' },
    { key: 'order_delivered', name: 'Order Delivered' },
    { key: 'admin_new_order', name: 'Admin New Order Alert' },
    { key: 'password_reset', name: 'Password Reset' },
    { key: 'promotional', name: 'Promotional Email' }
  ];

  const commonVariables = [
    '{{customer_name}}', '{{customer_email}}', '{{order_number}}', 
    '{{order_total}}', '{{payment_reference}}', '{{order_date}}',
    '{{store_name}}', '{{store_url}}', '{{support_email}}'
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .order('template_key');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch email templates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveTemplate = async (template: Partial<EmailTemplate>) => {
    try {
      if (selectedTemplate?.id) {
        // Update existing
        const { error } = await supabase
          .from('enhanced_email_templates')
          .update({
            subject_template: template.subject_template,
            html_template: template.html_template,
            text_template: template.text_template,
            variables: template.variables,
            is_active: template.is_active
          })
          .eq('id', selectedTemplate.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('enhanced_email_templates')
          .insert({
            template_key: template.template_key,
            template_name: templateTypes.find(t => t.key === template.template_key)?.name || template.template_key,
            subject_template: template.subject_template,
            html_template: template.html_template,
            text_template: template.text_template,
            variables: template.variables || [],
            template_type: 'transactional',
            is_active: template.is_active ?? true
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Email template saved successfully",
      });

      fetchTemplates();
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    }
  };

  const testEmailTemplate = async () => {
    if (!selectedTemplate || !testEmail) return;

    try {
      await supabase.functions.invoke('smtp-email-sender', {
        body: {
          to: testEmail,
          subject: `[TEST] ${selectedTemplate.subject_template}`,
          html: selectedTemplate.html_template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
            const testValues: Record<string, string> = {
              customer_name: 'John Doe',
              customer_email: testEmail,
              order_number: 'TEST-001',
              order_total: '₦15,500',
              payment_reference: 'TEST-REF-123',
              order_date: new Date().toLocaleDateString(),
              store_name: 'Your Store',
              store_url: 'https://your-store.com',
              support_email: 'support@your-store.com'
            };
            return testValues[variable] || match;
          }),
          text: selectedTemplate.text_template
        }
      });

      toast({
        title: "Test Email Sent",
        description: `Test email sent to ${testEmail}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to send test email",
        variant: "destructive",
      });
    }
  };

  const TemplateEditor = () => {
    const [formData, setFormData] = useState({
      template_key: selectedTemplate?.template_key || '',
      subject_template: selectedTemplate?.subject_template || '',
      html_template: selectedTemplate?.html_template || '',
      text_template: selectedTemplate?.text_template || '',
      variables: selectedTemplate?.variables || [],
      is_active: selectedTemplate?.is_active ?? true
    });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Template Type</label>
            <Select
              value={formData.template_key}
              onValueChange={(value) => setFormData({ ...formData, template_key: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select template type" />
              </SelectTrigger>
              <SelectContent>
                {templateTypes.map((type) => (
                  <SelectItem key={type.key} value={type.key}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Subject Line</label>
            <Input
              value={formData.subject_template}
              onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
              placeholder="Email subject..."
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">HTML Content</label>
          <div className="mb-2">
            <p className="text-xs text-muted-foreground">Available variables:</p>
            <div className="flex flex-wrap gap-1">
              {commonVariables.map((variable) => (
                <Badge key={variable} variant="secondary" className="text-xs">
                  {variable}
                </Badge>
              ))}
            </div>
          </div>
          <Textarea
            value={formData.html_template}
            onChange={(e) => setFormData({ ...formData, html_template: e.target.value })}
            rows={12}
            placeholder="HTML email content..."
          />
        </div>

        <div>
          <label className="text-sm font-medium">Text Content (Fallback)</label>
          <Textarea
            value={formData.text_template}
            onChange={(e) => setFormData({ ...formData, text_template: e.target.value })}
            rows={6}
            placeholder="Plain text version..."
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => saveTemplate(formData)}>
            <Save className="w-4 h-4 mr-2" />
            Save Template
          </Button>
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div>Loading email templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Email Template Manager</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage email templates for automated sending
          </p>
        </div>
        <Button onClick={() => { setSelectedTemplate(null); setIsEditing(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="lg:col-span-1">
          <h4 className="font-medium mb-3">Templates</h4>
          <div className="space-y-2">
            {templates.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-colors ${
                  selectedTemplate?.id === template.id ? 'border-primary' : ''
                }`}
                onClick={() => setSelectedTemplate(template)}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-sm">
                        {templateTypes.find(t => t.key === template.template_key)?.name || template.template_key}
                      </h5>
                      <p className="text-xs text-muted-foreground">{template.subject_template}</p>
                    </div>
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Template Details/Editor */}
        <div className="lg:col-span-2">
          {isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedTemplate ? 'Edit Template' : 'Create New Template'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TemplateEditor />
              </CardContent>
            </Card>
          ) : selectedTemplate ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      {templateTypes.find(t => t.key === selectedTemplate.template_key)?.name}
                    </CardTitle>
                    <CardDescription>{selectedTemplate.subject_template}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="preview" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="test">Test</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="preview">
                    <div className="border rounded-lg p-4 bg-background">
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedTemplate.html_template) }} />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="test">
                    <div className="space-y-4">
                      <Alert>
                        <Mail className="h-4 w-4" />
                        <AlertDescription>
                          Send a test email with sample data to verify the template
                        </AlertDescription>
                      </Alert>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Test email address"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                        />
                        <Button onClick={testEmailTemplate} disabled={!testEmail}>
                          <Send className="w-4 h-4 mr-2" />
                          Send Test
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Select a template to view or create a new one
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};