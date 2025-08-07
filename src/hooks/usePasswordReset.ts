import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const usePasswordReset = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendPasswordReset = async (email: string) => {
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });

      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('timeout') || msg.includes('context deadline exceeded') || msg.includes('504')) {
          toast({
            title: "Request queued",
            description: "Email provider is slow. Check your inbox in a few minutes or retry.",
          });
        } else {
          toast({
            title: "Password reset failed",
            description: error.message,
            variant: "destructive"
          });
        }
        return { success: false, error: error.message };
      }

      toast({
        title: "Reset email sent",
        description: "Please check your email for password reset instructions.",
      });

      return { success: true };
    } catch (error: any) {
      toast({
        title: "Password reset failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    sendPasswordReset
  };
};