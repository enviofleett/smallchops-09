import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SMTPSettings {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: boolean;
  sender_email: string;
  sender_name?: string;
  use_smtp: boolean;
}

export const useSMTPSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get SMTP settings
  const settingsQuery = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: async (): Promise<SMTPSettings | null> => {
      const { data, error } = await supabase
        .from('communication_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        // No settings found, return default
        return {
          smtp_host: '',
          smtp_port: 587,
          smtp_user: '',
          smtp_pass: '',
          smtp_secure: true,
          sender_email: '',
          sender_name: '',
          use_smtp: false
        };
      }

      return {
        id: data.id,
        smtp_host: data.smtp_host || '',
        smtp_port: data.smtp_port || 587,
        smtp_user: data.smtp_user || '',
        smtp_pass: data.smtp_pass || '',
        smtp_secure: data.smtp_secure !== false,
        sender_email: data.sender_email || '',
        sender_name: data.sender_name || '',
        use_smtp: data.use_smtp || false
      };
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Save SMTP settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: SMTPSettings) => {
      const { data, error } = await supabase
        .from('communication_settings')
        .upsert({
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_user: settings.smtp_user,
          smtp_pass: settings.smtp_pass,
          smtp_secure: settings.smtp_secure,
          sender_email: settings.sender_email,
          sender_name: settings.sender_name,
          use_smtp: settings.use_smtp
        })
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Settings Saved',
        description: 'SMTP settings have been saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['smtp-settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Save Failed',
        description: `Failed to save SMTP settings: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Test SMTP connection with enhanced error handling
  const testConnectionMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      // Try enhanced SMTP sender first, fallback to regular
      let lastError: Error | null = null;
      
      for (const sender of ['enhanced-smtp-sender', 'smtp-email-sender']) {
        try {
          const { data, error } = await supabase.functions.invoke(sender, {
            body: {
              to: testEmail,
              subject: 'SMTP Connection Test - Enhanced',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #3b82f6;">✅ SMTP Connection Test Successful!</h2>
                  <p>Congratulations! Your SMTP configuration is working correctly.</p>
                  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Connection Details:</h3>
                    <p><strong>Email Sender:</strong> ${sender}</p>
                    <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Status:</strong> <span style="color: #22c55e;">Connected Successfully</span></p>
                  </div>
                  <p style="color: #64748b;">You can now send emails reliably to your customers.</p>
                </div>
              `,
              text: `SMTP Connection Test Successful! Your email configuration is working correctly. Test completed at ${new Date().toLocaleString()} using ${sender}.`,
              emailType: 'transactional'
            }
          });

          if (error) {
            lastError = new Error(error.message || `Failed to send test email via ${sender}`);
            console.warn(`${sender} failed:`, error.message);
            continue;
          }

          console.log(`Test email sent successfully via ${sender}`);
          return { ...data, sender };
        } catch (senderError) {
          lastError = senderError as Error;
          console.warn(`${sender} failed:`, senderError);
          continue;
        }
      }
      
      throw lastError || new Error('All email senders failed');
    },
    onSuccess: () => {
      toast({
        title: 'Test Email Sent',
        description: 'Test email sent successfully! Check your inbox.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Test Failed',
        description: `Failed to send test email: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    saveSettings: saveSettingsMutation.mutate,
    saveSettingsAsync: saveSettingsMutation.mutateAsync,
    isSaving: saveSettingsMutation.isPending,
    testConnection: testConnectionMutation.mutate,
    testConnectionAsync: testConnectionMutation.mutateAsync,
    isTesting: testConnectionMutation.isPending,
  };
};