
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

  // Test email connection using unified SMTP sender with enhanced diagnostics
  const testConnectionMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      try {
        console.log('🧪 Testing email with unified SMTP sender (enhanced diagnostics)...');
        
        // Use standardized payload format with enhanced error reporting
        const payload = {
          to: testEmail,
          subject: 'SMTP Connection Test - Enhanced Diagnostics',
          templateKey: 'smtp_test', // Try template first
          variables: {
            test_time: new Date().toLocaleString(),
            smtp_host: 'Enhanced Unified SMTP System',
            business_name: 'Starters Small Chops',
            diagnostic_info: 'This test includes enhanced authentication and TLS diagnostics'
          },
          emailType: 'transactional',
          // Fallback content if template doesn't exist
          textContent: `SMTP Connection Test - Enhanced Diagnostics\n\nTest Time: ${new Date().toLocaleString()}\nSMTP Host: Enhanced Unified SMTP System\nBusiness: Starters Small Chops\n\nThis test includes enhanced authentication and TLS diagnostics.\n\nIf you receive this email, your SMTP configuration is working correctly!`,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb;">SMTP Connection Test - Enhanced</h2>
              <p>Congratulations! Your enhanced SMTP configuration is working correctly.</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Enhanced Test Details:</h3>
                <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>SMTP System:</strong> Enhanced Unified SMTP System</p>
                <p><strong>Business:</strong> Starters Small Chops</p>
                <p><strong>Diagnostics:</strong> Enhanced authentication and TLS validation</p>
              </div>
              <p>This email confirms that your enhanced email settings with improved authentication are properly configured and emails can be sent successfully.</p>
              <div style="background: #e0f7fa; padding: 10px; border-radius: 5px; margin-top: 20px;">
                <p style="margin: 0;"><strong>Security Note:</strong> Enhanced diagnostics and fallback mechanisms are now active.</p>
              </div>
            </div>`
        };

        console.log('📤 Sending enhanced test email payload:', payload);

        const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
          body: payload
        });

        if (error) {
          console.error('❌ Supabase function error:', error);
          throw new Error(error.message || 'Failed to send test email');
        }

        // Handle both success/error response formats
        if (data && !data.success && data.error) {
          console.error('❌ Enhanced SMTP test error:', data.error);
          throw new Error(`Enhanced SMTP test failed: ${data.error}`);
        }

        console.log('✅ Enhanced test email sent successfully:', data);
        return data;
      } catch (error) {
        console.error('💥 Enhanced SMTP test failed:', error);
        throw new Error(`Enhanced email test failed: ${error.message}`);
      }
    },
    onSuccess: (data) => {
      const message = data?.provider?.includes('fallback') 
        ? 'Test email sent successfully via fallback configuration! Check your inbox.'
        : 'Test email sent successfully! Check your inbox.';
        
      toast({
        title: 'Test Email Sent',
        description: message,
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
