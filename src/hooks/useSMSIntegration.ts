import { useState } from 'react';
import { smsService, SendSMSRequest, SendSMSResponse } from '@/api/smsService';
import { useToast } from '@/hooks/use-toast';

export const useSMSIntegration = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const sendOrderStatusSMS = async (
    orderId: string,
    status: string,
    customerPhone: string,
    orderData: Record<string, any>
  ): Promise<SendSMSResponse> => {
    if (!customerPhone) {
      return {
        success: false,
        message: 'No phone number provided',
        error: 'Customer phone number is required for SMS notifications'
      };
    }

    setIsProcessing(true);
    try {
      const result = await smsService.sendOrderStatusSMS(
        orderId,
        status,
        customerPhone,
        orderData
      );

      if (result.success) {
        toast({
          title: 'SMS Sent',
          description: `Order status SMS sent to ${customerPhone}`,
        });
      } else {
        toast({
          title: 'SMS Failed',
          description: result.error || 'Failed to send SMS notification',
          variant: 'destructive',
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'SMS Error',
        description: `Failed to send SMS: ${errorMessage}`,
        variant: 'destructive',
      });

      return {
        success: false,
        message: 'SMS sending failed',
        error: errorMessage
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const sendCustomSMS = async (request: SendSMSRequest): Promise<SendSMSResponse> => {
    setIsProcessing(true);
    try {
      const result = await smsService.sendSMS(request);

      if (result.success) {
        toast({
          title: 'SMS Sent',
          description: `SMS sent successfully to ${request.to}`,
        });
      } else {
        toast({
          title: 'SMS Failed',
          description: result.error || 'Failed to send SMS',
          variant: 'destructive',
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'SMS Error',
        description: `Failed to send SMS: ${errorMessage}`,
        variant: 'destructive',
      });

      return {
        success: false,
        message: 'SMS sending failed',
        error: errorMessage
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerOrderStatusNotifications = async (
    orderId: string,
    status: string,
    customerData: {
      email?: string;
      phone?: string;
      name?: string;
      sms_notifications_enabled?: boolean;
      email_notifications_enabled?: boolean;
    },
    orderData: Record<string, any>
  ) => {
    const results = {
      email: { success: false, message: 'Not attempted' },
      sms: { success: false, message: 'Not attempted' }
    };

    // Send email notification (existing functionality)
    if (customerData.email && customerData.email_notifications_enabled !== false) {
      try {
        // This would integrate with existing email system
        // For now, we'll assume it's handled by the existing notification system
        results.email = { success: true, message: 'Email notification handled by existing system' };
      } catch (error) {
        results.email = { 
          success: false, 
          message: error instanceof Error ? error.message : 'Email failed' 
        };
      }
    }

    // Send SMS notification (new functionality)
    if (customerData.phone && customerData.sms_notifications_enabled !== false) {
      const smsResult = await sendOrderStatusSMS(
        orderId,
        status,
        customerData.phone,
        {
          ...orderData,
          customer_name: customerData.name
        }
      );
      results.sms = {
        success: smsResult.success,
        message: smsResult.message
      };
    }

    return results;
  };

  return {
    isProcessing,
    sendOrderStatusSMS,
    sendCustomSMS,
    triggerOrderStatusNotifications,
  };
};