import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useEmailService } from '@/hooks/useEmailService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FileText, 
  Plus, 
  Edit, 
  Eye, 
  Trash2, 
  Save,
  TestTube,
  Copy,
  Filter,
  Grid,
  List,
  Palette,
  Tag
} from 'lucide-react';

interface TemplateFormData {
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template: string;
  template_type: 'transactional' | 'marketing';
  category?: string;
  style?: string;
  is_active: boolean;
  variables: string[];
}

const defaultTemplates = [
  {
    template_key: 'order_confirmation',
    template_name: 'Order Confirmation',
    subject_template: 'Order Confirmation #{{orderNumber}} - {{companyName}}',
    html_template: 
`<h1>Thank you for your order, \{\{customerName\}\}!</h1>
<p>Your order #\{\{orderNumber\}\} has been confirmed.</p>
<div style="background: #f5f5f5; padding: 20px; margin: 20px 0;">
  <h3>Order Details:</h3>
  <p><strong>Order Number:</strong> \{\{orderNumber\}\}</p>
  <p><strong>Total:</strong> $\{\{orderTotal\}\}</p>
  <p><strong>Delivery Address:</strong> \{\{deliveryAddress\}\}</p>
</div>
<p>We'll notify you when your order is ready for pickup or out for delivery.</p>`,
    text_template: 'Thank you for your order, \{\{customerName\}\}! Your order #\{\{orderNumber\}\} has been confirmed. Total: $\{\{orderTotal\}\}',
    template_type: 'transactional' as const,
    variables: ['customerName', 'orderNumber', 'orderTotal', 'companyName', 'deliveryAddress']
  },
  {
    template_key: 'user_welcome',
    template_name: 'Welcome New User',
    subject_template: 'Welcome to {{companyName}}, {{customerName}}!',
    html_template: `
<h1>Welcome to {{companyName}}, {{customerName}}!</h1>
<p>Thank you for creating an account with us. We're excited to have you as part of our community!</p>
<p>Here's what you can do with your account:</p>
<ul>
  <li>Track your orders</li>
  <li>Save your favorite products</li>
  <li>Manage your delivery preferences</li>
  <li>Access exclusive offers</li>
</ul>
<p><a href="{{loginUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a></p>
    `,
    text_template: 'Welcome to {{companyName}}, {{customerName}}! Thank you for creating an account. Visit {{loginUrl}} to get started.',
    template_type: 'transactional' as const,
    variables: ['customerName', 'companyName', 'loginUrl']
  },
  {
    template_key: 'password_reset',
    template_name: 'Password Reset',
    subject_template: 'Reset Your Password - {{companyName}}',
    html_template: `
<h1>Password Reset Request</h1>
<p>Hello {{customerName}},</p>
<p>We received a request to reset your password. Click the button below to reset it:</p>
<p><a href="{{resetUrl}}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
<p>If you didn't request this, please ignore this email. The link will expire in 24 hours.</p>
<p>For security, this link can only be used once.</p>
    `,
    text_template: 'Password reset requested for {{customerName}}. Visit {{resetUrl}} to reset your password. Link expires in 24 hours.',
    template_type: 'transactional' as const,
    variables: ['customerName', 'resetUrl', 'companyName']
  },
  {
    template_key: 'order_shipped',
    template_name: 'Order Shipped',
    subject_template: 'Your Order Has Shipped #{{orderNumber}}',
    html_template: `
<h1>Great news, {{customerName}}!</h1>
<p>Your order #{{orderNumber}} has been shipped and is on its way to you.</p>
<div style="background: #e8f5e8; padding: 20px; margin: 20px 0;">
  <h3>Tracking Information:</h3>
  <p><strong>Tracking Number:</strong> {{trackingNumber}}</p>
  <p><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
  <p><a href="{{trackingUrl}}">Track Your Package</a></p>
</div>
<p>Thank you for your business!</p>
    `,
    text_template: 'Your order #{{orderNumber}} has shipped! Tracking: {{trackingNumber}}. Track at {{trackingUrl}}',
    template_type: 'transactional' as const,
    variables: ['customerName', 'orderNumber', 'trackingNumber', 'trackingUrl', 'estimatedDelivery']
  },
  {
    template_key: 'admin_new_order',
    template_name: 'Admin New Order Notification',
    subject_template: 'New Order Received #{{orderNumber}}',
    html_template:
`<h1>New Order Alert</h1>
<p>A new order has been placed on your store.</p>
<div style="background: #f8f9fa; padding: 20px; margin: 20px 0;">
  <h3>Order Details:</h3>
  <p><strong>Order Number:</strong> \{\{orderNumber\}\}</p>
  <p><strong>Customer:</strong> \{\{customerName\}\} (\{\{customerEmail\}\})</p>
  <p><strong>Total:</strong> $\{\{orderTotal\}\}</p>
  <p><strong>Items:</strong> \{\{orderItems\}\}</p>
  <p><strong>Order Type:</strong> \{\{orderType\}\}</p>
</div>
<p>Please process this order promptly.</p>`,
    text_template: 'New order #\{\{orderNumber\}\} from \{\{customerName\}\}. Total: $\{\{orderTotal\}\}. Please process promptly.',
    template_type: 'transactional' as const,
    variables: ['orderNumber', 'customerName', 'customerEmail', 'orderTotal', 'orderItems', 'orderType']
  }
];

export const EmailTemplateManager = () => {
  const { templates, isLoadingTemplates } = useEmailService();
  const [editingTemplate, setEditingTemplate] = useState<TemplateFormData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const queryClient = useQueryClient();

  // Filter templates based on category and style
  const filteredTemplates = templates.filter(template => {
    const categoryMatch = selectedCategory === 'all' || template.category === selectedCategory;
    const styleMatch = selectedStyle === 'all' || template.style === selectedStyle;
    return categoryMatch && styleMatch;
  });

  // Get unique categories and styles for filters
  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];
  const styles = [...new Set(templates.map(t => t.style).filter(Boolean))];

  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: TemplateFormData) => {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .upsert({
          template_key: templateData.template_key,
          template_name: templateData.template_name,
          subject_template: templateData.subject_template,
          html_template: templateData.html_template,
          text_template: templateData.text_template,
          template_type: templateData.template_type,
          is_active: templateData.is_active,
          variables: templateData.variables
        }, {
          onConflict: 'template_key'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Template saved successfully');
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to save template: ${error.message}`);
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('enhanced_email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to delete template: ${error.message}`);
    }
  });

  const createDefaultTemplatesMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .upsert(defaultTemplates.map(template => ({
          ...template,
          is_active: true
        })), {
          onConflict: 'template_key'
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Default templates created successfully');
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to create templates: ${error.message}`);
    }
  });

  const handleEdit = (template: any) => {
    setEditingTemplate({
      template_key: template.template_key,
      template_name: template.template_name,
      subject_template: template.subject_template,
      html_template: template.html_template,
      text_template: template.text_template || '',
      template_type: template.template_type as 'transactional' | 'marketing',
      category: template.category,
      style: template.style,
      is_active: template.is_active,
      variables: template.variables || []
    });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate({
      template_key: '',
      template_name: '',
      subject_template: '',
      html_template: '',
      text_template: '',
      template_type: 'transactional',
      category: 'transactional',
      style: 'clean',
      is_active: true,
      variables: []
    });
    setIsDialogOpen(true);
  };

  const replaceVariables = (text: string, variables: Record<string, string>) => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/{{(\w+)}}/g);
    if (!matches) return [];
    return [...new Set(matches.map(match => match.replace(/[{}]/g, '')))];
  };

  const updateVariables = (template: TemplateFormData) => {
    const allText = `${template.subject_template} ${template.html_template} ${template.text_template}`;
    const foundVariables = extractVariables(allText);
    return { ...template, variables: foundVariables };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Templates</h2>
          <p className="text-muted-foreground">
            Manage your professional email templates with beautiful designs
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter by:</span>
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="order">📦 Order Templates</SelectItem>
            <SelectItem value="shipping">🚚 Shipping Updates</SelectItem>
            <SelectItem value="cart">🛒 Cart Recovery</SelectItem>
            <SelectItem value="welcome">🎉 Welcome Series</SelectItem>
            <SelectItem value="promotional">⚡ Promotional</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedStyle} onValueChange={setSelectedStyle}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Styles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Styles</SelectItem>
            <SelectItem value="clean">✨ Clean & Minimal</SelectItem>
            <SelectItem value="modern">🎨 Modern & Vibrant</SelectItem>
            <SelectItem value="bold">💥 Bold & Dynamic</SelectItem>
            <SelectItem value="elegant">👑 Elegant & Refined</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="ml-auto">
          {filteredTemplates.length} templates
        </Badge>
      </div>

      {isLoadingTemplates ? (
        <div className="text-center py-8">Loading templates...</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first email template or use our default templates to get started.
            </p>
            <Button onClick={() => createDefaultTemplatesMutation.mutate()}>
              <Copy className="mr-2 h-4 w-4" />
              Create Default Templates
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === 'grid' ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="group hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{template.template_name}</CardTitle>
                    {template.category && (
                      <Badge variant="outline" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {template.category}
                      </Badge>
                    )}
                  </div>
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2">
                  {template.template_key} • {template.template_type}
                  {template.style && (
                    <Badge variant="secondary" className="text-xs">
                      <Palette className="h-3 w-3 mr-1" />
                      {template.style}
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {template.subject_template}
                </p>
                
                {/* Template Preview */}
                <div className="bg-muted/50 p-3 rounded-md mb-4 max-h-24 overflow-hidden">
                  <div 
                    className="text-xs text-muted-foreground"
                    dangerouslySetInnerHTML={{
                      __html: template.html_template.slice(0, 150) + '...'
                    }}
                  />
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(template)}>
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      // Set preview data for this template
                      const sampleData: Record<string, string> = {};
                      (template.variables || []).forEach(variable => {
                        sampleData[variable] = `Sample ${variable}`;
                      });
                      setPreviewData(sampleData);
                      // Create a new template object for preview
                      setEditingTemplate({
                        template_key: template.template_key,
                        template_name: template.template_name,
                        subject_template: template.subject_template,
                        html_template: template.html_template,
                        text_template: template.text_template || '',
                        template_type: template.template_type as 'transactional' | 'marketing',
                        category: template.category,
                        style: template.style,
                        is_active: template.is_active,
                        variables: template.variables || []
                      });
                      setIsDialogOpen(true);
                    }}
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Preview
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteTemplateMutation.mutate(template.id)}>
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.template_key ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              Design your email template with variables like {'{{customerName}}'}
            </DialogDescription>
          </DialogHeader>
          
          {editingTemplate && (
            <Tabs defaultValue="edit" className="flex-1 overflow-hidden">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="edit" className="space-y-4 mt-4">
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="template-key">Template Key</Label>
                        <Input
                          id="template-key"
                          value={editingTemplate.template_key}
                          onChange={(e) => setEditingTemplate(updateVariables({...editingTemplate, template_key: e.target.value}))}
                          placeholder="order_confirmation"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input
                          id="template-name"
                          value={editingTemplate.template_name}
                          onChange={(e) => setEditingTemplate(updateVariables({...editingTemplate, template_name: e.target.value}))}
                          placeholder="Order Confirmation"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject-template">Subject Template</Label>
                      <Input
                        id="subject-template"
                        value={editingTemplate.subject_template}
                        onChange={(e) => setEditingTemplate(updateVariables({...editingTemplate, subject_template: e.target.value}))}
                        placeholder="Order Confirmation #{'{'}{'{'}}orderNumber{'}'}{'}'})"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="html-template">HTML Template</Label>
                      <Textarea
                        id="html-template"
                        value={editingTemplate.html_template}
                        onChange={(e) => setEditingTemplate(updateVariables({...editingTemplate, html_template: e.target.value}))}
                        placeholder="<h1>Hello {'{'}{'{'}}customerName{'}'}{'}'}} !</h1>"
                        rows={10}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="text-template">Text Template (Optional)</Label>
                      <Textarea
                        id="text-template"
                        value={editingTemplate.text_template}
                        onChange={(e) => setEditingTemplate(updateVariables({...editingTemplate, text_template: e.target.value}))}
                        placeholder="Hello {'{'}{'{'}}customerName{'}'}{'}'}}!"
                        rows={5}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="template-type">Template Type</Label>
                        <Select 
                          value={editingTemplate.template_type} 
                          onValueChange={(value: 'transactional' | 'marketing') => 
                            setEditingTemplate({...editingTemplate, template_type: value})
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transactional">Transactional</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <Switch
                          id="is-active"
                          checked={editingTemplate.is_active}
                          onCheckedChange={(checked) => setEditingTemplate({...editingTemplate, is_active: checked})}
                        />
                        <Label htmlFor="is-active">Active</Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Variables Found:</Label>
                      <div className="flex flex-wrap gap-2">
                        {editingTemplate.variables.map(variable => (
                          <Badge key={variable} variant="outline">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="preview" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label>Test Variables (for preview):</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {editingTemplate.variables.map(variable => (
                        <Input
                          key={variable}
                          placeholder={variable}
                          value={previewData[variable] || ''}
                          onChange={(e) => setPreviewData({...previewData, [variable]: e.target.value})}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Subject Preview:</h4>
                    <p>{replaceVariables(editingTemplate.subject_template, previewData)}</p>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">HTML Preview:</h4>
                    <div 
                      className="prose prose-sm"
                      dangerouslySetInnerHTML={{
                        __html: replaceVariables(editingTemplate.html_template, previewData)
                      }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => editingTemplate && saveTemplateMutation.mutate(editingTemplate)}
              disabled={saveTemplateMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};