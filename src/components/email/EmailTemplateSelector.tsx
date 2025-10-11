import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Eye, Send, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  template_type: string;
  category?: string;
  is_active: boolean;
}

interface EmailTemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  customerEmail: string;
  onEmailSent?: () => void;
}

export function EmailTemplateSelector({
  open,
  onClose,
  orderId,
  customerEmail,
  onEmailSent
}: EmailTemplateSelectorProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch active templates
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load email templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('preview_order_email', {
        p_order_id: orderId,
        p_template_key: selectedTemplate
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        toast.error(result.error || 'Failed to generate preview');
        return;
      }

      setPreview(result.preview);
      setShowPreview(true);
    } catch (error: any) {
      console.error('Preview failed:', error);
      toast.error('Failed to generate preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc('send_order_email_manual', {
        p_order_id: orderId,
        p_template_key: selectedTemplate,
        p_admin_id: user?.id
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        toast.error(result.error || 'Failed to send email');
        return;
      }

      toast.success('Email queued successfully', {
        description: `Email will be sent to ${customerEmail}`
      });

      onEmailSent?.();
      onClose();
    } catch (error: any) {
      console.error('Send failed:', error);
      toast.error('Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.template_key === selectedTemplate);

  return (
    <>
      <Dialog open={open && !showPreview} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email to Customer
            </DialogTitle>
            <DialogDescription>
              Select a template and send an email to {customerEmail}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.template_key}>
                      <div className="flex items-center justify-between w-full">
                        <span>{template.template_name}</span>
                        {template.category && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {template.category}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template Info */}
            {selectedTemplateData && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Subject:</span>
                      <Badge variant="outline">{selectedTemplateData.template_type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTemplateData.subject_template}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warning */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This email will be queued and sent to the customer within a few minutes.
                Make sure the order information is correct before sending.
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={!selectedTemplate || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Preview
              </Button>
              <Button
                onClick={handleSend}
                disabled={!selectedTemplate || isSending}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {preview && (
        <Dialog open={showPreview} onOpenChange={() => setShowPreview(false)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
              <DialogDescription>
                This is how the email will appear to the customer
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject:</label>
                <p className="text-sm font-semibold">{preview.subject}</p>
              </div>

              {/* HTML Preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Body:</label>
                <div
                  className="border rounded-lg p-4 bg-white"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Back
                </Button>
                <Button onClick={handleSend} disabled={isSending}>
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Email
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
