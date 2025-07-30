import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SMTPSettings {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  sender_email: string;
  sender_name?: string;
  enable_email: boolean;
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
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, return default
          return {
            smtp_host: '',
            smtp_port: 587,
            smtp_user: '',
            smtp_pass: '',
            sender_email: '',
            sender_name: 'Starters',
            enable_email: false
          };
        }
        throw error;
      }

      return {
        id: data.id,
        smtp_host: data.smtp_host || '',
        smtp_port: data.smtp_port || 587,
        smtp_user: data.smtp_user || '',
        smtp_pass: data.smtp_pass || '',
        sender_email: data.sender_email || '',
        sender_name: data.sender_name || 'Starters',
        enable_email: data.enable_email || false
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
          sender_email: settings.sender_email,
          sender_name: settings.sender_name,
          enable_email: settings.enable_email
        })
        .select()
        .single();

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

  // Test SMTP connection
  const testConnectionMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
        body: {
          to: testEmail,
          toName: 'Test User',
          subject: 'SMTP Connection Test',
          html: '<h1>Connection Test</h1><p>If you receive this email, your SMTP configuration is working correctly!</p>',
          text: 'Connection Test - If you receive this email, your SMTP configuration is working correctly!',
          emailType: 'transactional',
          priority: 'normal'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send test email');
      }

      return data;
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