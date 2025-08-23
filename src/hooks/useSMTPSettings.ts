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
          smtp_host: 'mail.startersmallchops.com',
          smtp_port: 587,
          smtp_user: 'store@startersmallchops.com',
          smtp_pass: '',
          smtp_secure: false, // Use STARTTLS instead of direct SSL
          sender_email: 'store@startersmallchops.com',
          sender_name: 'Starters Small Chops',
          use_smtp: false
        };
      }

      return {
        id: data.id,
        smtp_host: data.smtp_host || '',
        smtp_port: data.smtp_port || 587,
        smtp_user: data.smtp_user || '',
        smtp_pass: data.smtp_pass || '',
        smtp_secure: data.smtp_secure === true, // Default to STARTTLS (false) for better compatibility
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

  // Test email connection using SMTP sender
  const testConnectionMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      try {
        console.log('Testing email with SMTP Email Sender...');
        
        const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
          body: {
            templateId: 'smtp_test',
            recipient: { email: testEmail, name: 'Test User' },
            variables: {
              test_time: new Date().toLocaleString(),
              smtp_host: 'SMTP System',
              business_name: 'Starters Small Chops'
            },
            emailType: 'transactional'
          }
        });

        if (error) {
          throw new Error(error.message || 'Failed to send test email');
        }

        console.log('Test email sent successfully via SMTP Email Sender');
        return data;
      } catch (error) {
        console.error('SMTP email test failed:', error);
        throw new Error(`Email test failed: ${error.message}`);
      }
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