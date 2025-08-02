import React, { useState } from 'react';
import { Mail, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { resendWelcomeEmail } from '@/api/emailStatus';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EmailActionsProps {
  customerEmail: string;
  customerName: string;
  emailStatus: 'sent' | 'failed' | 'pending' | 'bounced' | 'none';
  onEmailResent?: () => void;
}

export const EmailActions = ({ 
  customerEmail, 
  customerName, 
  emailStatus, 
  onEmailResent 
}: EmailActionsProps) => {
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();

  const handleResendEmail = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click when clicking button
    
    if (!customerEmail) {
      toast({
        title: "Error",
        description: "Customer email is required to send welcome email",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);
    try {
      const success = await resendWelcomeEmail(customerEmail);
      
      if (success) {
        toast({
          title: "Email Queued",
          description: `Welcome email has been queued for ${customerName}`,
        });
        onEmailResent?.();
      } else {
        throw new Error('Failed to queue email');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send welcome email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  // Show resend button for failed, bounced, or none status
  const shouldShowResend = ['failed', 'bounced', 'none'].includes(emailStatus);

  if (!shouldShowResend) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResendEmail}
            disabled={isResending || !customerEmail}
            className="h-8 w-8 p-0 hover:bg-blue-50"
          >
            {isResending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 text-blue-600" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Resend welcome email</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};