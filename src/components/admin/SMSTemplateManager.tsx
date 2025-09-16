import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Edit, Plus, Save, X, MessageSquare, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SMSTemplate {
  id: string;
  template_key: string;
  template_name: string;
  content: string;
  variables: string[];
  category: string;
  is_active: boolean;
  max_length: number;
  created_at: string;
  updated_at: string;
}

export const SMSTemplateManager = () => {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const defaultTemplate = {
    id: '',
    template_key: '',
    template_name: '',
    content: '',
    variables: [],
    category: 'order_status',
    is_active: true,
    max_length: 160,
    created_at: '',
    updated_at: '',
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to handle Json type for variables
      const transformedTemplates = (data || []).map(template => ({
        ...template,
        variables: Array.isArray(template.variables) ? template.variables : 
                  typeof template.variables === 'string' ? 
                    JSON.parse(template.variables) : []
      }));
      
      setTemplates(transformedTemplates);
    } catch (error) {
      console.error('Error loading SMS templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load SMS templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    try {
      // Extract variables from template content
      const variableMatches = editingTemplate.content.match(/\{\{([^}]+)\}\}/g);
      const extractedVariables = variableMatches
        ? variableMatches.map(match => match.replace(/[{}]/g, ''))
        : [];

      const templateData = {
        ...editingTemplate,
        variables: extractedVariables,
      };

      let result;
      if (isCreating) {
        const { data, error } = await supabase
          .from('sms_templates')
          .insert([templateData])
          .select()
          .single();
        result = { data, error };
      } else {
        const { data, error } = await supabase
          .from('sms_templates')
          .update(templateData)
          .eq('id', editingTemplate.id)
          .select()
          .single();
        result = { data, error };
      }

      if (result.error) throw result.error;

      toast({
        title: 'Success',
        description: `SMS template ${isCreating ? 'created' : 'updated'} successfully`,
      });

      setEditingTemplate(null);
      setIsCreating(false);
      loadTemplates();
    } catch (error) {
      console.error('Error saving SMS template:', error);
      toast({
        title: 'Error',
        description: `Failed to ${isCreating ? 'create' : 'update'} SMS template`,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SMS template?')) return;

    try {
      const { error } = await supabase
        .from('sms_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'SMS template deleted successfully',
      });

      loadTemplates();
    } catch (error) {
      console.error('Error deleting SMS template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete SMS template',
        variant: 'destructive',
      });
    }
  };

  const startEditing = (template: SMSTemplate) => {
    setEditingTemplate({ ...template });
    setIsCreating(false);
  };

  const startCreating = () => {
    setEditingTemplate({ ...defaultTemplate });
    setIsCreating(true);
  };

  const cancelEditing = () => {
    setEditingTemplate(null);
    setIsCreating(false);
  };

  const getCharacterCount = (content: string) => {
    return content.length;
  };

  const getCharacterCountColor = (count: number, maxLength: number) => {
    if (count > maxLength) return 'text-destructive';
    if (count > maxLength * 0.9) return 'text-warning';
    return 'text-muted-foreground';
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">SMS Template Manager</h2>
          <p className="text-muted-foreground">
            Create and manage SMS templates for order notifications
          </p>
        </div>
        <Button onClick={startCreating} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {editingTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCreating ? 'Create' : 'Edit'} SMS Template
            </CardTitle>
            <CardDescription>
              Configure SMS template for order status notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template_key">Template Key</Label>
                <Input
                  id="template_key"
                  value={editingTemplate.template_key}
                  onChange={(e) =>
                    setEditingTemplate(prev => prev ? { ...prev, template_key: e.target.value } : null)
                  }
                  placeholder="e.g., order_confirmed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template_name">Template Name</Label>
                <Input
                  id="template_name"
                  value={editingTemplate.template_name}
                  onChange={(e) =>
                    setEditingTemplate(prev => prev ? { ...prev, template_name: e.target.value } : null)
                  }
                  placeholder="e.g., Order Confirmed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={editingTemplate.category}
                  onValueChange={(value) =>
                    setEditingTemplate(prev => prev ? { ...prev, category: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order_status">Order Status</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_length">Max Length</Label>
                <Input
                  id="max_length"
                  type="number"
                  value={editingTemplate.max_length}
                  onChange={(e) =>
                    setEditingTemplate(prev => prev ? { ...prev, max_length: parseInt(e.target.value) } : null)
                  }
                  min="1"
                  max="1600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Message Content</Label>
              <Textarea
                id="content"
                value={editingTemplate.content}
                onChange={(e) =>
                  setEditingTemplate(prev => prev ? { ...prev, content: e.target.value } : null)
                }
                placeholder="Hi {{customer_name}}, your order #{{order_number}} has been confirmed!"
                rows={4}
              />
              <div className="flex justify-between text-sm">
                <p className="text-muted-foreground">
                  Use {'{{variable_name}}'} for dynamic content
                </p>
                <p className={getCharacterCountColor(
                  getCharacterCount(editingTemplate.content), 
                  editingTemplate.max_length
                )}>
                  {getCharacterCount(editingTemplate.content)}/{editingTemplate.max_length}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={editingTemplate.is_active}
                onCheckedChange={(checked) =>
                  setEditingTemplate(prev => prev ? { ...prev, is_active: checked } : null)
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={cancelEditing}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                {isCreating ? 'Create' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{template.template_name}</h3>
                    <Badge variant="secondary">{template.template_key}</Badge>
                    <Badge variant={template.is_active ? 'default' : 'secondary'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">{template.category}</Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.content}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {template.content.length}/{template.max_length} chars
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {template.variables.length} variables
                    </div>
                  </div>
                  
                  {template.variables.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {template.variables.map((variable, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEditing(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No SMS templates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first SMS template to start sending order notifications
            </p>
            <Button onClick={startCreating}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};