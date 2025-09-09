import React, { useState } from 'react';
import { RefreshCw, Mail, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { requeueFailedEmails } from '@/api/emailStatus';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface BulkEmailActionsProps {
  onEmailsRequeued?: () => void;
}

export const BulkEmailActions = ({ onEmailsRequeued }: BulkEmailActionsProps) => {
  const [isRequeuing, setIsRequeuing] = useState(false);
  const { toast } = useToast();

  const handleRequeueFailedEmails = async () => {
    setIsRequeuing(true);
    try {
      const result = await requeueFailedEmails();
      
      if (result.success) {
        toast({
          title: "Emails Requeued",
          description: `Successfully requeued ${result.count} failed welcome emails`,
        });
        onEmailsRequeued?.();
      } else {
        throw new Error('Failed to requeue emails');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to requeue failed emails. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRequeuing(false);
    }
  };

  return null;
};