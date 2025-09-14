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
      // Load production data for realistic template variables
      const productionVariables = await loadProductionData();
      
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: 'test@example.com',
          template_key: template.template_key,
          variables: productionVariables
        }
      });

      if (error) throw error;

      toast({
        title: "Test Email Sent",
        description: `Template "${template.template_name}" sent with live production data`,
      });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    }
  };

  const loadProductionData = async () => {
    try {
      // Get business settings for production branding
      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('name, tagline, website_url, working_hours')
        .limit(1)
        .maybeSingle();

      // Get recent customer data for realistic examples
      const { data: customerData } = await supabase
        .from('customer_accounts')
        .select('name, email')
        .limit(1)
        .maybeSingle();

      // Get recent order data for realistic examples
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_number, total_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Build comprehensive production data object
      return {
        // Business information
        business_name: businessSettings?.name || 'Your Business',
        business_tagline: businessSettings?.tagline || 'Quality products delivered',
        business_website: businessSettings?.website_url || 'https://yourbusiness.com',
        business_email: 'store@startersmallchops.com',
        business_phone: '+234123456789',
        business_hours: businessSettings?.working_hours || 'Mon-Fri 9AM-6PM',
        
        // Customer information
        customer_name: customerData?.name || 'John Doe',
        customer_email: customerData?.email || 'john@example.com',
        customerName: customerData?.name || 'John Doe',
        
        // Order information
        order_number: orderData?.order_number || 'ORD-2024-001',
        orderNumber: orderData?.order_number || 'ORD-2024-001',
        order_total: orderData?.total_amount?.toString() || '150.00',
        amount: orderData?.total_amount?.toString() || '150.00',
        order_status: orderData?.status || 'confirmed',
        
        // Common variables
        current_year: new Date().getFullYear().toString(),
        current_date: new Date().toLocaleDateString(),
        support_email: 'support@startersmallchops.com',
        
        // Delivery information
        delivery_address: '123 Main Street, Lagos, Nigeria',
        estimated_delivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()
      };
    } catch (error) {
      console.error('Error loading production data:', error);
      // Return fallback sample data if production data fails
      return {
        business_name: 'Your Business',
        customer_name: 'John Doe',
        customerName: 'John Doe',
        order_number: 'ORD-2024-001',
        orderNumber: 'ORD-2024-001',
        amount: '150.00',
        order_total: '150.00',
        current_year: new Date().getFullYear().toString(),
        current_date: new Date().toLocaleDateString()
      };
    }
  };

  const sendToCustomers = async (template: EmailTemplate) => {
    if (!confirm(`Are you sure you want to send "${template.template_name}" to all verified customers? This action cannot be undone.`)) {
      return;
    }

    setIsSaving(true);
    try {
      // Get all verified customers
      const { data: paidCustomers, error: customerError } = await supabase
        .from('customer_accounts')
        .select('id, email, name')
        .eq('email_verified', true);

      if (customerError) throw customerError;

      if (!paidCustomers || paidCustomers.length === 0) {
        toast({
          title: "No Recipients Found",
          description: "No verified customers found to send emails to",
          variant: "destructive",
        });
        return;
      }

      // Load production data with all tags
      const productionVariables = await loadProductionData();
      
      let successCount = 0;
      let failureCount = 0;

      // Send emails in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < paidCustomers.length; i += batchSize) {
        const batch = paidCustomers.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (customer) => {
          try {
            // Personalize variables for each customer
            const personalizedVariables = {
              ...productionVariables,
              customer_name: customer.name || 'Valued Customer',
              customer_email: customer.email,
              customerName: customer.name || 'Valued Customer'
            };

            const { error } = await supabase.functions.invoke('unified-smtp-sender', {
              body: {
                to: customer.email,
                template_key: template.template_key,
                variables: personalizedVariables
              }
            });

            if (error) throw error;
            
            // Log successful send for audit
            await supabase
              .from('audit_logs')
              .insert({
                action: 'mass_email_sent',
                category: 'Email Marketing',
                message: `Template "${template.template_name}" sent to ${customer.email}`,
                new_values: {
                  template_key: template.template_key,
                  recipient: customer.email,
                  customer_id: customer.id
                }
              });

            successCount++;
          } catch (error: any) {
            console.error(`Failed to send email to ${customer.email}:`, error);
            failureCount++;
            
            // Log failed send for tracking
            await supabase
              .from('audit_logs')
              .insert({
                action: 'mass_email_failed',
                category: 'Email Marketing', 
                message: `Failed to send template "${template.template_name}" to ${customer.email}: ${error.message}`,
                new_values: {
                  template_key: template.template_key,
                  recipient: customer.email,
                  customer_id: customer.id,
                  error: error.message
                }
              });
          }
        });

        // Wait for batch to complete before next batch
        await Promise.allSettled(batchPromises);
        
        // Small delay between batches to be respectful to email servers
        if (i + batchSize < paidCustomers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: "Mass Email Campaign Complete",
        description: `Successfully sent to ${successCount} customers. ${failureCount} failed.`,
        variant: successCount > 0 ? "default" : "destructive"
      });

    } catch (error: any) {
      console.error('Error in mass email campaign:', error);
      toast({
        title: "Campaign Failed", 
        description: error.message || "Failed to send mass email campaign",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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
      {/* Production Mode Alert */}
      <Alert className="border-orange-200 bg-orange-50">
        <AlertDescription>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              PRODUCTION MODE
            </Badge>
            <span className="text-orange-700">
              All email communications in production MUST use templates from this manager. 
              Fallback emails are disabled to ensure brand consistency and security.
            </span>
          </div>
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Template Manager</h2>
          <p className="text-muted-foreground">
            Manage production email templates - the single source of truth for all email communications
          </p>
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

            {/* Available Variables Reference */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Available Template Variables
                </CardTitle>
                <CardDescription className="text-xs">
                  Use these variables in your templates with double curly braces: <code>{'{{variable_name}}'}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <h4 className="font-medium text-green-700 mb-2">Business Information</h4>
                    <div className="space-y-1 text-xs">
                      <div><code>business_name</code> - Business name</div>
                      <div><code>business_tagline</code> - Business tagline</div>
                      <div><code>business_website</code> - Website URL</div>
                      <div><code>business_email</code> - Business email</div>
                      <div><code>business_phone</code> - WhatsApp number</div>
                      <div><code>business_hours</code> - Working hours</div>
                      <div><code>support_email</code> - Support email</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-blue-700 mb-2">Customer Information</h4>
                    <div className="space-y-1 text-xs">
                      <div><code>customer_name</code> - Customer full name</div>
                      <div><code>customerName</code> - Customer name (alias)</div>
                      <div><code>customer_email</code> - Customer email</div>
                    </div>
                    
                    <h4 className="font-medium text-purple-700 mb-2 mt-3">Date & Time</h4>
                    <div className="space-y-1 text-xs">
                      <div><code>current_year</code> - Current year</div>
                      <div><code>current_date</code> - Current date</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-orange-700 mb-2">Order Information</h4>
                    <div className="space-y-1 text-xs">
                      <div><code>order_number</code> - Order number</div>
                      <div><code>orderNumber</code> - Order number (alias)</div>
                      <div><code>order_total</code> - Order total amount</div>
                      <div><code>amount</code> - Amount (alias)</div>
                      <div><code>order_status</code> - Order status</div>
                      <div><code>delivery_address</code> - Delivery address</div>
                      <div><code>estimated_delivery</code> - Estimated delivery</div>
                    </div>
                  </div>
                </div>
                
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertDescription className="text-xs">
                    <strong>Pro tip:</strong> All variables are automatically populated with live production data when templates are sent. 
                    Test templates use real data from your database for accurate previews.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

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