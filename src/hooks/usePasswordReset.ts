import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const usePasswordReset = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendPasswordReset = async (email: string) => {
    try {
      setIsLoading(true);

      const send = () => supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });

      let { error } = await send();
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('timeout') || msg.includes('context deadline exceeded') || msg.includes('504')) {
          // Retry once after brief delay for transient SMTP/GoTrue timeouts
          await new Promise((r) => setTimeout(r, 1500));
          const retry = await send();
          if (!retry.error) {
            toast({ title: "Reset email sent", description: "Please check your email." });
            return { success: true };
          }
        }
        toast({
          title: "Password reset failed",
          description: error.message,
          variant: "destructive"
        });
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