import { useState } from 'react';
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

interface SendEmailParams {
  orderId: string;
  templateKey: string;
  adminId?: string;
}

interface PreviewEmailParams {
  orderId: string;
  templateKey: string;
}

export function useManualEmail() {
  const [isSending, setIsSending] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  /**
   * Fetch active email templates
   */
  const fetchTemplates = async (): Promise<EmailTemplate[]> => {
    setIsLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_name');

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load email templates');
      return [];
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  /**
   * Preview email with order data
   */
  const previewEmail = async ({ orderId, templateKey }: PreviewEmailParams) => {
    setIsLoadingPreview(true);
    try {
      const { data, error } = await supabase.rpc('preview_order_email', {
        p_order_id: orderId,
        p_template_key: templateKey
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        toast.error(result.error || 'Failed to generate preview');
        return null;
      }

      return result.preview;
    } catch (error: any) {
      console.error('Preview failed:', error);
      toast.error('Failed to generate preview');
      return null;
    } finally {
      setIsLoadingPreview(false);
    }
  };

  /**
   * Send email manually
   */
  const sendEmail = async ({ orderId, templateKey, adminId }: SendEmailParams) => {
    setIsSending(true);
    try {
      // Get current user if admin ID not provided
      let userId = adminId;
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      }

      const { data, error } = await supabase.rpc('send_order_email_manual', {
        p_order_id: orderId,
        p_template_key: templateKey,
        p_admin_id: userId
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        toast.error(result.error || 'Failed to send email');
        return { success: false, error: result.error };
      }

      toast.success('Email queued successfully', {
        description: 'Email will be sent within a few minutes'
      });

      return { success: true, eventId: result.event_id };
    } catch (error: any) {
      console.error('Send failed:', error);
      toast.error('Failed to send email');
      return { success: false, error: error.message };
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Validate template
   */
  const validateTemplate = async (templateKey: string) => {
    try {
      const { data, error } = await supabase.rpc('validate_email_template', {
        p_template_key: templateKey
      });

      if (error) throw error;

      const result = data as any;
      if (!result.valid) {
        console.error('Template validation errors:', result.errors);
        return { valid: false, errors: result.errors };
      }

      return { valid: true, template: result.template };
    } catch (error: any) {
      console.error('Validation failed:', error);
      return { valid: false, errors: [error.message] };
    }
  };

  return {
    sendEmail,
    previewEmail,
    fetchTemplates,
    validateTemplate,
    isSending,
    isLoadingTemplates,
    isLoadingPreview
  };
}
