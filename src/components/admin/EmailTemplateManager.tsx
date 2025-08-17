import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Save, 
  X,
  Mail,
  Code,
  TestTube
} from 'lucide-react';

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template?: string;
  variables: string[];
  template_type: string;
  category: string;
  style: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const EmailTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const defaultTemplate: Partial<EmailTemplate> = {
    template_key: '',
    template_name: '',
    subject_template: '',
    html_template: '',
    text_template: '',
    variables: [],
    template_type: 'transactional',
    category: 'transactional',
    style: 'clean',
    is_active: true
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
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
    setIsSaving(true);
    try {
      // Basic validation
      if (!template.template_key || !template.template_name || !template.subject_template || !template.html_template) {
        toast({
          title: "Validation Failed",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      if (editingTemplate?.id) {
        // Update existing template
        const { error } = await supabase
          .from('enhanced_email_templates')
          .update({
            template_key: template.template_key!,
            template_name: template.template_name!,
            subject_template: template.subject_template!,
            html_template: template.html_template!,
            text_template: template.text_template,
            variables: template.variables || [],
            template_type: template.template_type!,
            category: template.category!,
            style: template.style!,
            is_active: template.is_active ?? true
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Template Updated",
          description: "Email template updated successfully",
        });
      } else {
        // Create new template
        const { error } = await supabase
          .from('enhanced_email_templates')
          .insert({
            template_key: template.template_key!,
            template_name: template.template_name!,
            subject_template: template.subject_template!,
            html_template: template.html_template!,
            text_template: template.text_template,
            variables: template.variables || [],
            template_type: template.template_type!,
            category: template.category!,
            style: template.style!,
            is_active: template.is_active ?? true
          });

        if (error) throw error;

        toast({
          title: "Template Created",
          description: "Email template created successfully",
        });
      }

      setEditingTemplate(null);
      setIsCreateMode(false);
      await fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save email template",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('enhanced_email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Template Deleted",
        description: "Email template deleted successfully",
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete email template",
        variant: "destructive",
      });
    }
  };

  const testTemplate = async (template: EmailTemplate) => {
    try {
      const { data, error } = await supabase.functions.invoke('production-email-processor', {
        body: {
          to: 'test@example.com',
          template_key: template.template_key,
          variables: {
            customerName: 'Test User',
            orderNumber: 'TEST-001',
            amount: '100.00'
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Test Email Sent",
        description: "Template test email sent successfully",
      });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const startCreate = () => {
    setEditingTemplate(defaultTemplate as EmailTemplate);
    setIsCreateMode(true);
  };

  const startEdit = (template: EmailTemplate) => {
    setEditingTemplate({ ...template });
    setIsCreateMode(false);
  };

  const cancelEdit = () => {
    setEditingTemplate(null);
    setIsCreateMode(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Mail className="h-8 w-8 animate-pulse mx-auto mb-2" />
          <p>Loading email templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Template Manager</h2>
          <p className="text-muted-foreground">Create and manage email templates</p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {editingTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCreateMode ? 'Create Email Template' : 'Edit Email Template'}
            </CardTitle>
            <CardDescription>
              Design and configure your email template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template_key">Template Key</Label>
                <Input
                  id="template_key"
                  value={editingTemplate.template_key}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    template_key: e.target.value
                  })}
                  placeholder="e.g., order_confirmation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template_name">Template Name</Label>
                <Input
                  id="template_name"
                  value={editingTemplate.template_name}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    template_name: e.target.value
                  })}
                  placeholder="e.g., Order Confirmation"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="template_type">Type</Label>
                <Select
                  value={editingTemplate.template_type}
                  onValueChange={(value) => setEditingTemplate({
                    ...editingTemplate,
                    template_type: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transactional">Transactional</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="notification">Notification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={editingTemplate.category}
                  onValueChange={(value) => setEditingTemplate({
                    ...editingTemplate,
                    category: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transactional">Transactional</SelectItem>
                    <SelectItem value="order">Order</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="style">Style</Label>
                <Select
                  value={editingTemplate.style}
                  onValueChange={(value) => setEditingTemplate({
                    ...editingTemplate,
                    style: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clean">Clean</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="classic">Classic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject_template">Subject Template</Label>
              <Input
                id="subject_template"
                value={editingTemplate.subject_template}
                onChange={(e) => setEditingTemplate({
                  ...editingTemplate,
                  subject_template: e.target.value
                })}
                placeholder="e.g., Order Confirmation - {{orderNumber}}"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="html_template">HTML Template</Label>
              <Textarea
                id="html_template"
                value={editingTemplate.html_template}
                onChange={(e) => setEditingTemplate({
                  ...editingTemplate,
                  html_template: e.target.value
                })}
                placeholder="Enter HTML email template..."
                className="min-h-[200px] font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text_template">Text Template (Optional)</Label>
              <Textarea
                id="text_template"
                value={editingTemplate.text_template || ''}
                onChange={(e) => setEditingTemplate({
                  ...editingTemplate,
                  text_template: e.target.value
                })}
                placeholder="Enter plain text version..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="variables">Variables (comma-separated)</Label>
              <Input
                id="variables"
                value={editingTemplate.variables?.join(', ') || ''}
                onChange={(e) => setEditingTemplate({
                  ...editingTemplate,
                  variables: e.target.value.split(',').map(v => v.trim()).filter(v => v)
                })}
                placeholder="e.g., customerName, orderNumber, amount"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editingTemplate.is_active}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    is_active: e.target.checked
                  })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={() => saveTemplate(editingTemplate)}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {template.template_name}
                    <Badge variant={template.is_active ? 'default' : 'secondary'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">
                      {template.template_type}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Key: {template.template_key} • Category: {template.category}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testTemplate(template)}
                  >
                    <TestTube className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <strong>Subject:</strong> {template.subject_template}
                </div>
                {template.variables && template.variables.length > 0 && (
                  <div>
                    <strong>Variables:</strong> {template.variables.join(', ')}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Created: {new Date(template.created_at).toLocaleDateString()}
                  {template.updated_at !== template.created_at && (
                    <span> • Updated: {new Date(template.updated_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first email template to get started
              </p>
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};