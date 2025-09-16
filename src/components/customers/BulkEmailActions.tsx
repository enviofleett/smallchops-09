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

  return (
    <div className="flex items-center gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isRequeuing}
            className="flex items-center gap-2"
          >
            {isRequeuing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Requeue Failed Emails
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Requeue Failed Welcome Emails
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will requeue all failed welcome emails from the last 24 hours. 
              Failed emails will be marked as "queued" and will be processed again by the email system.
              <br /><br />
              This action is useful after fixing SMTP configuration issues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRequeueFailedEmails}>
              Requeue Emails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};