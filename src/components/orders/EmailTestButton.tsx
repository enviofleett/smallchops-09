import React, { useState } from 'react';
import { Mail, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailTestButtonProps {
  orderId: string;
  customerEmail?: string;
  orderNumber?: string;
  className?: string;
}

export const EmailTestButton: React.FC<EmailTestButtonProps> = ({
  orderId,
  customerEmail,
  orderNumber,
  className
}) => {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const testEmailSystem = async () => {
    if (!customerEmail) {
      toast({
        title: 'No Customer Email',
        description: 'This order does not have a customer email address.',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    
    try {
      // Test email automation by triggering a status change email
      const { error } = await supabase.functions.invoke('user-journey-automation', {
        body: {
          journey_type: 'order_status_change',
          user_data: {
            email: customerEmail,
            name: 'Test Customer'
          },
          order_data: {
            order_id: orderId,
            order_number: orderNumber || 'TEST001',
            status: 'ready'
          },
          metadata: {
            test_email: true,
            old_status: 'preparing',
            new_status: 'ready',
            updated_at: new Date().toISOString()
          }
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Test Email Queued',
        description: `A test "Order Ready" email has been queued for ${customerEmail}. Check your email system logs to confirm delivery.`,
        className: 'bg-green-50 border-green-200 text-green-800'
      });

    } catch (error: any) {
      toast({
        title: 'Email Test Failed',
        description: error.message || 'Failed to queue test email',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  if (!customerEmail) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={className}
      >
        <AlertCircle className="w-4 h-4 mr-2" />
        No Email
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={testEmailSystem}
      disabled={testing}
      className={className}
    >
      {testing ? (
        <>
          <Send className="w-4 h-4 mr-2 animate-pulse" />
          Testing...
        </>
      ) : (
        <>
          <Mail className="w-4 h-4 mr-2" />
          Test Email
        </>
      )}
    </Button>
  );
};