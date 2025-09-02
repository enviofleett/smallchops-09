import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Plus, Edit, Eye, Send, History, Save, X, Code, Palette, 
  FileText, Mail, TestTube, Package, RefreshCw, ChevronRight,
  Sparkles, Clock, User, AlertCircle, Check
} from 'lucide-react';

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template: string;
  variables: string[];
  template_type: 'transactional' | 'marketing';
  category: string;
  style: string;
  is_active: boolean;
  full_html: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateVersion {
  id: string;
  version_number: number;
  change_note: string;
  changed_by: string;
  changed_at: string;
  subject_template: string;
  html_template: string;
  text_template: string;
}

type EditorMode = 'visual' | 'html';

export const EmailTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('visual');
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [testEmail, setTestEmail] = useState('');
  const [sampleVariables, setSampleVariables] = useState<Record<string, string>>({});
  const [isSeeding, setIsSeeding] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<EmailTemplate>>({
    template_key: '',
    template_name: '',
    subject_template: '',
    html_template: '',
    text_template: '',
    variables: [],
    template_type: 'transactional',
    category: 'system',
    style: 'modern',
    is_active: true,
    full_html: false
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .order('template_name');

      if (error) throw error;
      setTemplates((data || []) as EmailTemplate[]);
    } catch (error: any) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load templates: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from('enhanced_email_template_versions')
        .select('*')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
      setShowVersions(true);
    } catch (error: any) {
      console.error('Failed to load versions:', error);
      toast.error('Failed to load template versions: ' + error.message);
    }
  };

  const saveTemplate = async () => {
    try {
      if (!formData.template_key || !formData.template_name) {
        toast.error('Template key and name are required');
        return;
      }

      const templateData = {
        ...formData,
        variables: formData.variables || [],
        updated_at: new Date().toISOString()
      };

      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('enhanced_email_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template updated successfully');
      } else {
        // Create new template
        const { error } = await supabase
          .from('enhanced_email_templates')
          .insert(templateData as any);

        if (error) throw error;
        toast.success('Template created successfully');
      }

      setEditingTemplate(null);
      setFormData({
        template_key: '',
        template_name: '',
        subject_template: '',
        html_template: '',
        text_template: '',
        variables: [],
        template_type: 'transactional',
        category: 'system',
        style: 'modern',
        is_active: true,
        full_html: false
      });
      await loadTemplates();
    } catch (error: any) {
      console.error('Failed to save template:', error);
      toast.error('Failed to save template: ' + error.message);
    }
  };

  const seedTemplates = async () => {
    try {
      setIsSeeding(true);
      const { data, error } = await supabase.functions.invoke('email-template-seeder');

      if (error) throw error;

      const result = data;
      if (result.success) {
        toast.success(`Seeded ${result.statistics.created + result.statistics.updated} templates successfully`);
        await loadTemplates();
      } else {
        throw new Error(result.error || 'Unknown seeding error');
      }
    } catch (error: any) {
      console.error('Failed to seed templates:', error);
      toast.error('Failed to seed templates: ' + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const testSendTemplate = async (template: EmailTemplate) => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    try {
      const variables = { ...sampleVariables };
      
      // Add common variables if not provided
      if (!variables.business_name) variables.business_name = 'Test Business';
      if (!variables.customer_name) variables.customer_name = 'Test Customer';
      if (!variables.current_year) variables.current_year = new Date().getFullYear().toString();

      const { error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          template_key: template.template_key,
          variables: variables
        }
      });

      if (error) throw error;
      toast.success(`Test email sent to ${testEmail}`);
    } catch (error: any) {
      console.error('Failed to send test email:', error);
      toast.error('Failed to send test email: ' + error.message);
    }
  };

  const insertVariable = (variable: string) => {
    const placeholder = `{{${variable}}}`;
    
    if (editorMode === 'html') {
      // For HTML mode, insert at cursor position in textarea
      const textarea = document.querySelector('textarea[data-html-editor]') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const newText = text.substring(0, start) + placeholder + text.substring(end);
        setFormData(prev => ({ ...prev, html_template: newText }));
        
        // Set cursor position after inserted variable
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 0);
      }
    } else {
      // For visual mode, append to content
      setFormData(prev => ({ 
        ...prev, 
        html_template: (prev.html_template || '') + ' ' + placeholder 
      }));
    }
  };

  const renderPreview = (template: EmailTemplate) => {
    let htmlContent = template.html_template;
    
    // Replace variables with sample data
    Object.entries(sampleVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      htmlContent = htmlContent.replace(regex, value);
    });

    // Apply dark mode styles if needed
    if (previewMode === 'dark') {
      htmlContent = htmlContent.replace(
        /style="([^"]*background[^"]*(?:white|#ffffff|#fff)[^"]*)/gi,
        'style="$1background: #1f2937 !important; color: #f9fafb !important;'
      );
    }

    return htmlContent;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Email Templates</h2>
          <p className="text-muted-foreground">Manage and customize your email templates</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={seedTemplates} 
            disabled={isSeeding}
            className="flex items-center gap-2"
          >
            {isSeeding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            {isSeeding ? 'Seeding...' : 'Seed Templates'}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </DialogTitle>
                <DialogDescription>
                  Create or modify email templates with advanced editing capabilities
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Editor */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Basic Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="template_key">Template Key</Label>
                      <Input
                        id="template_key"
                        value={formData.template_key}
                        onChange={(e) => setFormData(prev => ({ ...prev, template_key: e.target.value }))}
                        placeholder="e.g., customer_welcome"
                      />
                    </div>
                    <div>
                      <Label htmlFor="template_name">Template Name</Label>
                      <Input
                        id="template_name"
                        value={formData.template_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
                        placeholder="e.g., Customer Welcome Email"
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <Label htmlFor="subject">Subject Template</Label>
                    <Input
                      id="subject"
                      value={formData.subject_template}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject_template: e.target.value }))}
                      placeholder="Welcome to {{business_name}}!"
                    />
                  </div>

                  {/* Editor Mode Toggle */}
                  <div className="flex items-center gap-4">
                    <Label>Editor Mode:</Label>
                    <Tabs value={editorMode} onValueChange={(value) => setEditorMode(value as EditorMode)}>
                      <TabsList>
                        <TabsTrigger value="visual" className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          Visual
                        </TabsTrigger>
                        <TabsTrigger value="html" className="flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          HTML
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.full_html}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, full_html: checked }))}
                      />
                      <Label>Full HTML Mode</Label>
                    </div>
                  </div>

                  {/* Content Editor */}
                  <div>
                    <Label>Email Content</Label>
                    {editorMode === 'visual' ? (
                      <RichTextEditor
                        value={formData.html_template || ''}
                        onChange={(content) => setFormData(prev => ({ ...prev, html_template: content }))}
                        placeholder="Design your email template..."
                      />
                    ) : (
                      <Textarea
                        data-html-editor
                        value={formData.html_template}
                        onChange={(e) => setFormData(prev => ({ ...prev, html_template: e.target.value }))}
                        placeholder="<div>Your HTML content here...</div>"
                        className="min-h-64 font-mono text-sm"
                      />
                    )}
                  </div>

                  {/* Text Template */}
                  <div>
                    <Label htmlFor="text_template">Plain Text Version</Label>
                    <Textarea
                      id="text_template"
                      value={formData.text_template}
                      onChange={(e) => setFormData(prev => ({ ...prev, text_template: e.target.value }))}
                      placeholder="Plain text version of your email..."
                      className="min-h-32"
                    />
                  </div>

                  {/* Settings */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Type</Label>
                      <Select 
                        value={formData.template_type} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, template_type: value as 'transactional' | 'marketing' }))}
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
                    <div>
                      <Label>Category</Label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System</SelectItem>
                          <SelectItem value="orders">Orders</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="auth">Authentication</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <Label>Active</Label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button onClick={saveTemplate} className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save Template
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingTemplate(null)}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>

                {/* Sidebar - Variables Assistant */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Variables Assistant
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Quick Variables */}
                      <div>
                        <Label className="text-xs font-medium">Common Variables:</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {['business_name', 'customer_name', 'order_number', 'current_year'].map((variable) => (
                            <Button
                              key={variable}
                              variant="outline"
                              size="sm"
                              className="text-xs h-6 px-2"
                              onClick={() => insertVariable(variable)}
                            >
                              {variable}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Variables */}
                      <div>
                        <Label className="text-xs font-medium">Template Variables:</Label>
                        <Input
                          placeholder="Add variable..."
                          className="text-xs h-8 mt-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const value = (e.target as HTMLInputElement).value.trim();
                              if (value) {
                                const newVars = [...(formData.variables || []), value];
                                setFormData(prev => ({ ...prev, variables: newVars }));
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                          {formData.variables?.map((variable, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => insertVariable(variable)}
                            >
                              {variable}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Preview */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Live Preview
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant={previewMode === 'light' ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs h-6"
                          onClick={() => setPreviewMode('light')}
                        >
                          Light
                        </Button>
                        <Button
                          variant={previewMode === 'dark' ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs h-6"
                          onClick={() => setPreviewMode('dark')}
                        >
                          Dark
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className={`border rounded p-2 max-h-40 overflow-auto text-xs ${
                          previewMode === 'dark' ? 'bg-gray-900 text-white' : 'bg-white'
                        }`}
                        dangerouslySetInnerHTML={{ 
                          __html: formData.html_template || '<p class="text-muted-foreground">Start typing to see preview...</p>' 
                        }}
                      />
                    </CardContent>
                  </Card>

                  {/* Test Send */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TestTube className="h-4 w-4" />
                        Test Send
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        placeholder="test@example.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="text-xs h-8"
                      />
                      <Button
                        size="sm"
                        className="w-full text-xs h-8"
                        disabled={!formData.template_key || !testEmail}
                        onClick={() => formData.template_key && testSendTemplate(formData as EmailTemplate)}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Send Test
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Templates List */}
      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{template.template_name}</h3>
                    <Badge variant={template.is_active ? 'default' : 'secondary'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">{template.template_type}</Badge>
                    <Badge variant="secondary">{template.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Key: <code className="bg-muted px-1 rounded">{template.template_key}</code>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Subject: {template.subject_template}
                  </p>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.variables.map((variable, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadVersions(template.id)}
                    className="flex items-center gap-2"
                  >
                    <History className="h-4 w-4" />
                    Versions
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Preview
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle>Preview: {template.template_name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Button
                            variant={previewMode === 'light' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreviewMode('light')}
                          >
                            Light Mode
                          </Button>
                          <Button
                            variant={previewMode === 'dark' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreviewMode('dark')}
                          >
                            Dark Mode
                          </Button>
                        </div>
                        <div className="border rounded-lg p-4 max-h-96 overflow-auto">
                          <div dangerouslySetInnerHTML={{ __html: renderPreview(template) }} />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingTemplate(template);
                      setFormData(template);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by seeding default templates or creating your first custom template.
            </p>
            <Button onClick={seedTemplates} disabled={isSeeding} className="flex items-center gap-2">
              {isSeeding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              {isSeeding ? 'Seeding Templates...' : 'Seed Default Templates'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Version History Dialog */}
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Template Version History</DialogTitle>
            <DialogDescription>
              View and restore previous versions of this template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-auto">
            {versions.map((version) => (
              <Card key={version.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{version.version_number}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(version.changed_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{version.change_note}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <History className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};