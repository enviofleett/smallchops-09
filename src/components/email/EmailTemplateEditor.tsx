import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Save, X, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface EmailTemplateEditorProps {
  templateId: string | null;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  templateId,
  onSaveSuccess,
  onCancel
}) => {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    template_key: '',
    template_name: '',
    subject_template: '',
    html_template: '',
    category: 'order',
    is_active: true,
    template_type: 'transactional',
    full_html: false,
    style: '',
    variables: [] as string[]
  });

  const { data: template, isLoading } = useQuery({
    queryKey: ['email-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!templateId
  });

  useEffect(() => {
    if (template) {
      setFormData({
        template_key: template.template_key || '',
        template_name: template.template_name || '',
        subject_template: template.subject_template || '',
        html_template: template.html_template || '',
        category: template.category || 'order',
        is_active: template.is_active ?? true,
        template_type: template.template_type || 'transactional',
        full_html: template.full_html ?? false,
        style: template.style || '',
        variables: template.variables || []
      });
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validation
      const errors = [];
      
      if (!data.template_name?.trim()) {
        errors.push('Template name is required');
      }
      
      if (!data.template_key?.trim()) {
        errors.push('Template key is required');
      }
      
      if (!data.subject_template?.trim()) {
        errors.push('Subject template is required');
      }
      
      if (!data.html_template?.trim()) {
        errors.push('HTML template is required');
      }
      
      // Validate variable syntax in templates
      const varRegex = /\{\{(\w+)\}\}/g;
      const subjectVars = [...(data.subject_template?.matchAll(varRegex) || [])].map(m => m[1]);
      const htmlVars = [...(data.html_template?.matchAll(varRegex) || [])].map(m => m[1]);
      const allVars = [...new Set([...subjectVars, ...htmlVars])];
      
      console.log('📝 Template variables detected:', allVars);
      
      if (errors.length > 0) {
        throw new Error(errors.join(', '));
      }

      if (templateId) {
        const { error } = await supabase
          .from('enhanced_email_templates')
          .update(data)
          .eq('id', templateId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('enhanced_email_templates')
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: '✅ Template saved',
        description: `Template ${templateId ? 'updated' : 'created'} successfully and is ready for use`
      });
      onSaveSuccess();
    },
    onError: (error: any) => {
      console.error('❌ Template save error:', error);
      toast({
        title: 'Failed to save template',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {templateId ? 'Edit Template' : 'Create New Template'}
            </h3>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template_key">Template Key *</Label>
              <Input
                id="template_key"
                value={formData.template_key}
                onChange={(e) => setFormData({ ...formData, template_key: e.target.value })}
                placeholder="order_confirmed"
                required
                disabled={!!templateId}
              />
              <p className="text-xs text-muted-foreground">Unique identifier (cannot be changed)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template_name">Template Name *</Label>
              <Input
                id="template_name"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="Order Confirmed"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="order">Order</option>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template_type">Template Type</Label>
              <select
                id="template_type"
                value={formData.template_type}
                onChange={(e) => setFormData({ ...formData, template_type: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="transactional">Transactional</option>
                <option value="marketing">Marketing</option>
                <option value="notification">Notification</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject_template">Email Subject Template *</Label>
            <Input
              id="subject_template"
              value={formData.subject_template}
              onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
              placeholder="Your order has been confirmed - {{order_number}}"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use {`{{variable_name}}`} for dynamic content
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="html_template">HTML Template *</Label>
            <Textarea
              id="html_template"
              value={formData.html_template}
              onChange={(e) => setFormData({ ...formData, html_template: e.target.value })}
              placeholder="<h1>Hello {{customer_name}}!</h1><p>Your order {{order_number}} has been confirmed.</p>"
              className="font-mono text-sm min-h-[300px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="style">Additional CSS Styles</Label>
            <Textarea
              id="style"
              value={formData.style}
              onChange={(e) => setFormData({ ...formData, style: e.target.value })}
              placeholder=".header { background: #333; color: white; }"
              className="font-mono text-sm min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="variables">Template Variables (comma-separated)</Label>
            <Input
              id="variables"
              value={formData.variables.join(', ')}
              onChange={(e) => setFormData({ 
                ...formData, 
                variables: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
              })}
              placeholder="customer_name, order_number, total_amount"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Template Active</Label>
          </div>
        </form>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <strong>Subject:</strong>
              <p className="mt-1 p-2 bg-muted rounded">{formData.subject_template}</p>
            </div>
            <div>
              <strong>HTML Template:</strong>
              <div
                className="mt-1 p-4 bg-white border rounded"
                dangerouslySetInnerHTML={{ __html: formData.html_template }}
              />
            </div>
            {formData.style && (
              <div>
                <strong>Custom Styles:</strong>
                <pre className="mt-1 p-2 bg-muted rounded text-sm whitespace-pre-wrap font-mono">
                  {formData.style}
                </pre>
              </div>
            )}
            {formData.variables.length > 0 && (
              <div>
                <strong>Variables:</strong>
                <p className="mt-1 p-2 bg-muted rounded text-sm">
                  {formData.variables.join(', ')}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
