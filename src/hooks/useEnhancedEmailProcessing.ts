import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProcessingResult {
  success: boolean;
  processed: number;
  failed: number;
  message: string;
}

export const useEnhancedEmailProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processInstantEmails = useCallback(async (priority: 'high' | 'all' = 'high'): Promise<ProcessingResult> => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('email-queue-processor', {
        body: { 
          action: priority === 'all' ? 'process_all_priorities' : 'process_queue',
          priority: priority === 'high' ? 'high' : 'normal'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const processedCount = priority === 'all' 
        ? data.total?.processed || 0 
        : data.processed || 0;
      const failedCount = priority === 'all' 
        ? data.total?.failed || 0 
        : data.failed || 0;

      const result = {
        success: true,
        processed: processedCount,
        failed: failedCount,
        message: `Successfully processed ${processedCount} emails via SMTP`
      };

      toast({
        title: "Email Processing Complete",
        description: result.message,
      });

      return result;
    } catch (error: any) {
      const result = {
        success: false,
        processed: 0,
        failed: 0,
        message: error.message || 'Failed to process emails'
      };

      toast({
        title: "Email Processing Failed",
        description: result.message,
        variant: "destructive",
      });

      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const processWelcomeEmails = useCallback(async (): Promise<ProcessingResult> => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('email-queue-processor', {
        body: { action: 'process_queue', priority: 'normal' }
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = {
        success: true,
        processed: data.processed || 0,
        failed: data.failed || 0,
        message: `Successfully processed ${data.processed || 0} welcome emails via SMTP`
      };

      toast({
        title: "Welcome Emails Processed",
        description: result.message,
      });

      return result;
    } catch (error: any) {
      const result = {
        success: false,
        processed: 0,
        failed: 0,
        message: error.message || 'Failed to process welcome emails'
      };

      toast({
        title: "Welcome Email Processing Failed",
        description: result.message,
        variant: "destructive",
      });

      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const triggerEnhancedProcessing = useCallback(async (email: string, eventType: string = 'customer_welcome'): Promise<boolean> => {
    try {
      // Create communication event with high priority
      const { error } = await supabase
        .from('communication_events')
        .insert({
          event_type: eventType,
          recipient_email: email,
          status: 'queued',
          priority: 'high',
          template_variables: {
            email,
            timestamp: new Date().toISOString()
          }
        });

      if (error) {
        throw new Error(error.message);
      }

      // Immediately process the high priority queue
      await processInstantEmails('high');
      return true;
    } catch (error: any) {
      console.error('Error triggering enhanced processing:', error);
      toast({
        title: "Processing Trigger Failed",
        description: error.message || 'Failed to trigger enhanced email processing',
        variant: "destructive",
      });
      return false;
    }
  }, [processInstantEmails, toast]);

  return {
    isProcessing,
    processInstantEmails,
    processWelcomeEmails,
    triggerEnhancedProcessing
  };
};